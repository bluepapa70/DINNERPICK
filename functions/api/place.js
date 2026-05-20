/**
 * Cloudflare Pages Function — 카카오 장소 상세 정보 프록시
 * 별점, 리뷰 수, 메뉴 목록을 반환합니다.
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

    const data      = await res.json();
    const basic     = data.basicInfo  || {};
    const feedback  = basic.feedback  || {};
    const menuinfo  = basic.menuinfo  || {};

    const scorecnt  = Number(feedback.scorecnt  || 0);
    const scoresum  = Number(feedback.scoresum  || 0);
    const reviewcnt = Number(feedback.reviewcnt || 0);
    const rating    = scorecnt > 0 ? (scoresum / scorecnt).toFixed(1) : null;

    const menus = (menuinfo.menuList || []).slice(0, 5).map(m => ({
        name:  m.menu  || '',
        price: m.price || ''
    }));

    return json({ rating, scorecnt, reviewcnt, menus });
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
