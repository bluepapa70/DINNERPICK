/**
 * Cloudflare Pages Function — 카카오 장소 상세 정보 프록시
 * 별점, 리뷰 수, 메뉴, 영업시간, 홈페이지 반환
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const id  = url.searchParams.get('id');

    if (!id) {
        return json({ error: 'id가 필요합니다.' }, 400);
    }

    const res = await fetch(`https://place.map.kakao.com/m/main/v/${id}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            'Referer':    'https://map.kakao.com/'
        }
    });

    if (!res.ok) {
        return json({ error: '장소 정보를 가져올 수 없습니다.', status: res.status }, 502);
    }

    let data;
    try {
        data = await res.json();
    } catch (e) {
        const text = await res.text().catch(() => '');
        return json({ error: 'JSON 파싱 실패', preview: text.slice(0, 300) }, 502);
    }

    // 최상위 키 목록을 debug 필드로 노출
    const basic    = data.basicInfo || data.place || data.document || {};
    const debugKeys = Object.keys(data);

    // ── 별점 ──────────────────────────────────────────────
    const feedback  = basic.feedback || {};
    const scorecnt  = Number(feedback.scorecnt  || 0);
    const scoresum  = Number(feedback.scoresum  || 0);
    const reviewcnt = Number(feedback.reviewcnt || 0);
    const rating    = scorecnt > 0 ? (scoresum / scorecnt).toFixed(1) : null;

    // ── 메뉴 ──────────────────────────────────────────────
    const menuinfo = basic.menuinfo || {};
    const menus = (menuinfo.menuList || []).slice(0, 5).map(m => ({
        name:  m.menu  || '',
        price: m.price || ''
    }));

    // ── 영업시간 ───────────────────────────────────────────
    const openHour  = basic.openHour || {};
    const realtime  = openHour.realtime || {};
    const isOpen    = realtime.open      ?? null;
    const isBreak   = realtime.breaktime ?? false;
    const isHoliday = realtime.holiday   ?? false;

    let hours = null;
    const periodList = openHour.periodList || [];
    if (periodList.length > 0) {
        const timeList = periodList[0].timeList || [];
        if (timeList.length > 0) {
            const t = timeList[0];
            const fmt = s => s ? `${s.slice(0,2)}:${s.slice(2,4)}` : '';
            const day = t.dayOfWeek ? `${t.dayOfWeek} ` : '';
            hours = `${day}${fmt(t.beginTime)} ~ ${fmt(t.endTime)}`;
            // 브레이크 타임
            const breakItem = timeList.find(x => x.timeName && x.timeName.includes('브레이크'));
            if (breakItem) {
                hours += ` / 브레이크 ${fmt(breakItem.beginTime)}~${fmt(breakItem.endTime)}`;
            }
        }
    }

    // ── 홈페이지 ───────────────────────────────────────────
    const homepageList = basic.homepageList || [];
    const homepage = homepageList.length > 0 ? homepageList[0].homepage : null;

    // ── 주차 ──────────────────────────────────────────────
    const facilityInfo = basic.facilityInfo || {};
    const parking = facilityInfo.parking || null;

    return json({ rating, scorecnt, reviewcnt, menus, isOpen, isBreak, isHoliday, hours, homepage, parking, _debug: { keys: debugKeys, hasFeedback: !!data.basicInfo?.feedback, hasOpenHour: !!data.basicInfo?.openHour } });
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
