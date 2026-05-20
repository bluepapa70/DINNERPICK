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
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept':     'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer':    'https://m.map.kakao.com/',
        'Origin':     'https://m.map.kakao.com',
    };

    const candidates = [
        `https://place.map.kakao.com/m/place/v/${id}`,
        `https://place.map.kakao.com/m/main/v/${id}`,
        `https://place.map.kakao.com/place/v/${id}`,
        `https://place.map.kakao.com/m/place/${id}`,
        `https://place.map.kakao.com/${id}`,
    ];

    let data    = null;
    let usedUrl = null;
    const errors = [];

    for (const endpoint of candidates) {
        try {
            const res = await fetch(endpoint, { headers });
            const statusCode = res.status;

            if (!res.ok) {
                errors.push({ url: endpoint, status: statusCode });
                continue;
            }

            const text = await res.text();
            try {
                const raw = JSON.parse(text);
                if (raw && typeof raw === 'object') {
                    data    = raw;
                    usedUrl = endpoint;
                    break;
                }
                errors.push({ url: endpoint, status: statusCode, issue: 'not an object' });
            } catch (e) {
                errors.push({ url: endpoint, status: statusCode, parseError: e.message, preview: text.slice(0, 200) });
            }
        } catch (e) {
            errors.push({ url: endpoint, fetchError: e.message });
        }
    }

    if (!data) {
        return json({ error: '장소 정보를 가져올 수 없습니다. (모든 엔드포인트 실패)', _errors: errors }, 502);
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
    const parking      = basic.facilityInfo?.parking || null;

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
