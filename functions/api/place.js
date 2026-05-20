/**
 * Cloudflare Pages Function — 카카오 장소 상세 정보 프록시
 * place.map.kakao.com/{id} HTML에서 데이터 추출
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const id  = url.searchParams.get('id');

    if (!id) {
        return json({ error: 'id가 필요합니다.' }, 400);
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer':         'https://m.map.kakao.com/',
    };

    const res = await fetch(`https://place.map.kakao.com/${id}`, { headers });
    if (!res.ok) {
        return json({ error: 'HTML 페이지 요청 실패', status: res.status }, 502);
    }

    const html = await res.text();

    // ── 1. JSON-LD (schema.org) ──────────────────────────────────────────────
    const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (ldMatch) {
        try {
            const ld     = JSON.parse(ldMatch[1]);
            const result = extractFromLd(ld);
            result._source = 'json-ld';
            return json(result);
        } catch { /* fall through */ }
    }

    // ── 2. window.__DATA__ 또는 유사 전역 변수 ─────────────────────────────
    const dataPatterns = [
        /window\.__DATA__\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/i,
        /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/i,
        /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/i,
        /\bPLACE_DATA\s*=\s*(\{[\s\S]*?\});/i,
    ];
    for (const pattern of dataPatterns) {
        const m = html.match(pattern);
        if (m) {
            try {
                const raw    = JSON.parse(m[1]);
                const result = extractFromRaw(raw);
                result._source = 'global-var';
                return json(result);
            } catch { /* fall through */ }
        }
    }

    // ── 3. 디버그: HTML 미리보기 반환 ─────────────────────────────────────
    return json({
        error: '파싱 가능한 데이터 없음',
        _htmlPreview: html.slice(0, 3000)
    }, 200);
}

// JSON-LD (schema.org) 에서 추출
function extractFromLd(ld) {
    const result = {
        rating: null, scorecnt: 0, reviewcnt: 0,
        menus: [], isOpen: null, isBreak: false, isHoliday: false,
        hours: null, homepage: null, parking: null
    };

    if (ld.aggregateRating) {
        const r = ld.aggregateRating;
        result.rating    = r.ratingValue != null ? parseFloat(r.ratingValue).toFixed(1) : null;
        result.reviewcnt = Number(r.reviewCount || r.ratingCount || 0);
        result.scorecnt  = result.reviewcnt;
    }

    if (ld.openingHours) {
        result.hours = Array.isArray(ld.openingHours)
            ? ld.openingHours.join(' / ')
            : String(ld.openingHours);
    }

    if (ld.url) result.homepage = ld.url;
    if (ld.sameAs) result.homepage = result.homepage || (Array.isArray(ld.sameAs) ? ld.sameAs[0] : ld.sameAs);

    if (ld.hasMenu && typeof ld.hasMenu === 'string') {
        result.homepage = result.homepage || ld.hasMenu;
    }

    if (ld.servesCuisine) {
        const cuisines = Array.isArray(ld.servesCuisine) ? ld.servesCuisine : [ld.servesCuisine];
        result.menus = cuisines.slice(0, 5).map(c => ({ name: c, price: '' }));
    }

    return result;
}

// 원시 JS 객체에서 추출 (window.__DATA__ 등)
function extractFromRaw(raw) {
    const basic    = raw.basicInfo || raw.place || raw || {};
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
            const fmt = s => s ? `${s.slice(0,2)}:${s.slice(2,4)}` : '';
            const day = t.dayOfWeek ? `${t.dayOfWeek} ` : '';
            hours     = `${day}${fmt(t.beginTime)} ~ ${fmt(t.endTime)}`;
            const brk = timeList.find(x => x.timeName?.includes('브레이크'));
            if (brk) hours += ` / 브레이크 ${fmt(brk.beginTime)}~${fmt(brk.endTime)}`;
        }
    }

    const homepageList = basic.homepageList || [];
    const homepage     = homepageList[0]?.homepage || null;
    const parking      = basic.facilityInfo?.parking || null;

    return { rating, scorecnt, reviewcnt, menus, isOpen, isBreak, isHoliday, hours, homepage, parking };
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
