/**
 * Cloudflare Pages Function — Kakao Local API 프록시
 * 환경변수 KAKAO_REST_API_KEY 를 Cloudflare Pages 대시보드에 등록해야 합니다.
 */
export async function onRequest(context) {
    const url    = new URL(context.request.url);
    const x      = url.searchParams.get('x');
    const y      = url.searchParams.get('y');
    const radius = url.searchParams.get('radius') || '1000';
    const category = url.searchParams.get('category') || 'FD6';

    if (!x || !y) {
        return json({ error: '좌표(x, y)가 필요합니다.' }, 400);
    }

    const apiKey = context.env.KAKAO_REST_API_KEY;
    if (!apiKey) {
        return json({ error: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.' }, 500);
    }

    const pages = [];
    let isEnd   = false;
    let page    = 1;

    // 카카오 로컬 API는 페이지당 최대 15개, 최대 3페이지(45개)까지 수집
    while (!isEnd && page <= 3) {
        const apiUrl = new URL('https://dapi.kakao.com/v2/local/search/category.json');
        apiUrl.searchParams.set('category_group_code', 'FD6');
        apiUrl.searchParams.set('x', x);
        apiUrl.searchParams.set('y', y);
        apiUrl.searchParams.set('radius', radius);
        apiUrl.searchParams.set('sort', 'distance');
        apiUrl.searchParams.set('size', '15');
        apiUrl.searchParams.set('page', page);

        const res  = await fetch(apiUrl.toString(), {
            headers: { Authorization: `KakaoAK ${apiKey}` }
        });

        if (!res.ok) {
            return json({ error: 'Kakao API 오류', status: res.status }, 502);
        }

        const data = await res.json();
        pages.push(...(data.documents || []));
        isEnd = data.meta?.is_end ?? true;
        page++;
    }

    // 카테고리 키워드 필터 (FD6 전체가 아닌 경우)
    let documents = pages;
    if (category !== 'FD6') {
        documents = pages.filter(d => d.category_name && d.category_name.includes(category));
    }

    return json({ documents, total: documents.length });
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
