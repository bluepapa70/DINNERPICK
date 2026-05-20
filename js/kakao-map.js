const KakaoMapService = {
    miniMap: null,

    initMiniMap(containerId, lat, lng, name) {
        const el = document.getElementById(containerId);
        if (!el || typeof kakao === 'undefined') return;

        const position = new kakao.maps.LatLng(lat, lng);
        this.miniMap = new kakao.maps.Map(el, { center: position, level: 3 });

        new kakao.maps.Marker({ position, map: this.miniMap });

        const info = new kakao.maps.InfoWindow({
            content: `<div style="padding:5px 8px;font-size:12px;font-weight:700;white-space:nowrap;">${name}</div>`,
            removable: false
        });
        info.open(this.miniMap, new kakao.maps.Marker({ position, map: this.miniMap }));
    },

    navigateTo(lat, lng, name) {
        const url = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
        window.open(url, '_blank');
    }
};
