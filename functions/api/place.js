/**
 * Cloudflare Pages Function — 카카오 장소 상세 정보 프록시
 * 전략: HTML og:url에서 canonical ID 추출 → 번들에서 API 경로 탐색
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const id  = url.searchParams.get('id');

    if (!id) {
        return json({ error: 'id가 필요합니다.' }, 400);
    }

    const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

    // ── 1. HTML 페이지에서 canonical ID + 번들 URL 추출 ──────────────────────
    const htmlRes = await fetch(`https://place.map.kakao.com/${id}`, {
        headers: {
            'User-Agent':      mobileUA,
            'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9',
        }
    });

    let canonicalId = id;
    let bundleUrl   = null;
    let finalUrl    = htmlRes.url;

    if (htmlRes.ok) {
        const html = await htmlRes.text();

        // og:url에서 canonical ID 추출
        const ogUrl = html.match(/<meta\s+property="og:url"\s+content="[^"]*\/(\d+)"/i);
        if (ogUrl) canonicalId = ogUrl[1];

        // 번들 URL 추출
        const bundleMatch = html.match(/src="(https:\/\/t1\.kakaocdn\.net\/kakaomapweb\/[^"]+\/index\.js)"/);
        if (bundleMatch) bundleUrl = bundleMatch[1];
    }

    // ── 2. 번들 첫 300KB에서 API 경로 패턴 탐색 ───────────────────────────
    let foundApiPaths = [];
    if (bundleUrl) {
        try {
            const bRes = await fetch(bundleUrl, {
                headers: {
                    'User-Agent': mobileUA,
                    'Range':      'bytes=0-300000',
                }
            });
            if (bRes.ok || bRes.status === 206) {
                const chunk = await bRes.text();
                // "/place/v/", "/m/place/", "/api/place" 등의 패턴 탐색
                const re = /["'`](\/[a-z/]+(?:place|detail|info)[a-z/]*)["'`$]/gi;
                let m;
                const seen = new Set();
                while ((m = re.exec(chunk)) !== null) {
                    const p = m[1];
                    if (!seen.has(p) && p.length < 60) {
                        seen.add(p);
                        foundApiPaths.push(p);
                    }
                    if (seen.size >= 30) break;
                }
            }
        } catch { /* 번들 로드 실패 무시 */ }
    }

    // ── 3. canonical ID로 API 후보 시도 ────────────────────────────────────
    const apiHeaders = {
        'User-Agent':      mobileUA,
        'Accept':          'application/json, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer':         `https://place.map.kakao.com/${canonicalId}`,
        'Origin':          'https://place.map.kakao.com',
    };

    // 번들에서 찾은 경로 + 기본 후보들
    const baseCandidates = [
        `/m/place/v/`,
        `/m/main/v/`,
        `/place/v/`,
        `/m/place/`,
        `/place/`,
    ];

    const bundleCandidates = foundApiPaths
        .filter(p => /\/(?:place|main)\/(?:v\/)?$/.test(p + '/'))
        .map(p => p.replace(/\/$/, '') + '/');

    const allPaths = [...new Set([...bundleCandidates, ...baseCandidates])];

    for (const path of allPaths) {
        for (const tryId of [...new Set([canonicalId, id])]) {
            const endpoint = `https://place.map.kakao.com${path}${tryId}`;
            try {
                const res = await fetch(endpoint, { headers: apiHeaders });
                if (!res.ok) continue;
                const text = await res.text();
                try {
                    const raw = JSON.parse(text);
                    if (raw && typeof raw === 'object' && !raw.error) {
                        return json(buildResult(raw, { usedUrl: endpoint, canonicalId }));
                    }
                } catch { /* not JSON */ }
            } catch { /* fetch failed */ }
        }
    }

    // ── 4. 완전 실패: 디버그 반환 ──────────────────────────────────────────
    return json({
        error: '장소 상세 정보를 가져올 수 없습니다.',
        _debug: {
            originalId:  id,
            canonicalId,
            finalUrl,
            bundleUrl,
            foundApiPaths,
            triedPaths:  allPaths,
        }
    }, 200);
}

function buildResult(data, meta = {}) {
    const basic    = data.basicInfo || data.place || data || {};
    const feedback = basic.feedback || {};
    const menuinfo = basic.menuinfo || {};
    const openHour = basic.openHour || {};
    const realtime = openHour.realtime || {};

    const scorecnt  = Number(feedback.scorecnt  || 0);
    const scoresum  = Number(feedback.scoresum  || 0);
    const reviewcnt = Number(feedback.reviewcnt || 0);
    const rating    = scorecnt > 0 ? (scoresum / scorecnt).toFixed(1) : null;

    const menus = (menuinfo.menuList || []).slice(0, 5).map(m => ({
        name:  m.menu  || '',
        price: m.price || ''
    }));

    const isOpen    = realtime.open      ?? null;
    const isBreak   = realtime.breaktime ?? false;
    const isHoliday = realtime.holiday   ?? false;

    let hours = null;
    const periodList = openHour.periodList || [];
    if (periodList.length > 0) {
        const timeList = periodList[0].timeList || [];
        if (timeList.length > 0) {
            const t   = timeList[0];
            const fmt = s => s ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : '';
            const day = t.dayOfWeek ? `${t.dayOfWeek} ` : '';
            hours     = `${day}${fmt(t.beginTime)} ~ ${fmt(t.endTime)}`;
            const brk = timeList.find(x => x.timeName?.includes('브레이크'));
            if (brk) hours += ` / 브레이크 ${fmt(brk.beginTime)}~${fmt(brk.endTime)}`;
        }
    }

    const homepage = (basic.homepageList || [])[0]?.homepage || null;
    const parking  = basic.facilityInfo?.parking || null;

    return {
        rating, scorecnt, reviewcnt, menus,
        isOpen, isBreak, isHoliday, hours,
        homepage, parking,
        _debug: meta
    };
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
