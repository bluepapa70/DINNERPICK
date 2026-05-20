/**
 * Cloudflare Pages Function — 카카오 장소 상세 정보 프록시
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const id  = url.searchParams.get('id');

    if (!id) {
        return json({ error: 'id가 필요합니다.' }, 400);
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        'Accept':     'application/json, text/plain, */*',
        'Referer':    'https://map.kakao.com/',
        'Origin':     'https://map.kakao.com'
    };

    // 여러 엔드포인트를 순서대로 시도
    const candidates = [
        `https://place.map.kakao.com/m/place/v/${id}`,
        `https://place.map.kakao.com/m/main/v/${id}`,
        `https://place.map.kakao.com/place/v/${id}`,
    ];

    let data = null;
    let usedUrl = null;

    for (const endpoint of candidates) {
        const res = await fetch(endpoint, { headers });
        if (!res.ok) continue;
        try {
            const raw = await res.json();
            if (raw && typeof raw === 'object') {
                data    = raw;
                usedUrl = endpoint;
                break;
            }
        } catch { /* JSON 파싱 실패 시 다음 URL 시도 */ }
    }

    if (!data) {
        return json({ error: '장소 정보를 가져올 수 없습니다. (모든 엔드포인트 실패)' }, 502);
    }

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
            const fmt = s => s ? `${s.slice(0,2)}:${s.slice(2,4)}` : '';
            const day = t.dayOfWeek ? `${t.dayOfWeek} ` : '';
            hours     = `${day}${fmt(t.beginTime)} ~ ${fmt(t.endTime)}`;
            const brk = timeList.find(x => x.timeName?.includes('브레이크'));
            if (brk) hours += ` / 브레이크 ${fmt(brk.beginTime)}~${fmt(brk.endTime)}`;
        }
    }

    const homepageList = basic.homepageList || [];
    const homepage     = homepageList[0]?.homepage || null;

    const parking = basic.facilityInfo?.parking || null;

    return json({
        rating, scorecnt, reviewcnt, menus,
        isOpen, isBreak, isHoliday, hours,
        homepage, parking,
        _debug: { usedUrl, topKeys: Object.keys(data) }
    });
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
