/**
 * Cloudflare Pages Function — 카카오 장소 상세 정보 프록시
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const id  = url.searchParams.get('id');

    if (!id) return json({ error: 'id가 필요합니다.' }, 400);

    const kakaoKey = context.env.KAKAO_REST_API_KEY || '';

    // SDK 버전은 index.html의 kakao.js URL에서 확인 (4.4.24)
    const baseHeaders = {
        'User-Agent':      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'KA':              'sdk/4.4.24 os/web origin/place.map.kakao.com',
        'Referer':         'https://place.map.kakao.com/',
        'Origin':          'https://place.map.kakao.com',
    };

    const withKey = { ...baseHeaders, 'Authorization': `KakaoAK ${kakaoKey}` };

    // 시도할 엔드포인트 목록 (응답 구조가 다를 수 있어 모두 시도)
    const candidates = [
        // 구형 map.kakao.com API
        { url: `https://map.kakao.com/actions/getPlaceInfo?id=${id}&lang=ko`,   h: baseHeaders },
        { url: `https://map.kakao.com/app/place/basic?id=${id}&lang=ko`,        h: baseHeaders },
        { url: `https://map.kakao.com/app/place/all?id=${id}&lang=ko`,          h: baseHeaders },
        { url: `https://map.kakao.com/m/search/placeinfo?id=${id}`,             h: baseHeaders },
        // REST API 키 사용 (dapi)
        { url: `https://dapi.kakao.com/v2/local/place/${id}`,                  h: withKey },
        { url: `https://dapi.kakao.com/v1/places/${id}`,                       h: withKey },
        // place.map.kakao.com 변형
        { url: `https://place.map.kakao.com/m/place/v/${id}`,  h: { ...baseHeaders, 'KA': 'sdk/4.4.24 os/ios origin/place.map.kakao.com' } },
        { url: `https://place.map.kakao.com/m/main/v/${id}`,   h: { ...baseHeaders, 'KA': 'sdk/4.4.24 os/ios origin/place.map.kakao.com' } },
        { url: `https://place.map.kakao.com/v1/place/${id}`,   h: baseHeaders },
        { url: `https://place.map.kakao.com/api/place/${id}`,  h: baseHeaders },
    ];

    const errors = [];

    for (const { url: endpoint, h } of candidates) {
        try {
            const res  = await fetch(endpoint, { headers: h });
            const status = res.status;

            if (!res.ok) {
                errors.push({ url: endpoint, status });
                continue;
            }

            const text = await res.text();
            let raw;
            try { raw = JSON.parse(text); } catch (e) {
                errors.push({ url: endpoint, status, issue: 'not-json', preview: text.slice(0, 80) });
                continue;
            }

            if (!raw || typeof raw !== 'object') {
                errors.push({ url: endpoint, status, issue: 'not-object' });
                continue;
            }

            // 성공 — 데이터 파싱
            return json(buildResult(raw, endpoint));

        } catch (e) {
            errors.push({ url: endpoint, fetchError: e.message });
        }
    }

    return json({ error: '모든 엔드포인트 실패', _errors: errors }, 502);
}

function buildResult(data, usedUrl) {
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
        _debug: { usedUrl, topKeys: Object.keys(data) }
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
