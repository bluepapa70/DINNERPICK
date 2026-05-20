const KakaoMapService = {
    miniMap: null,
    infoWindow: null,

    initMiniMap(containerId, lat, lng, restaurant) {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (typeof kakao === 'undefined' || !kakao.maps) {
            el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.4);font-size:12px;">지도를 불러올 수 없어요</div>';
            return;
        }
        try {
            const position = new kakao.maps.LatLng(lat, lng);
            this.miniMap = new kakao.maps.Map(el, { center: position, level: 3 });
            const marker = new kakao.maps.Marker({ position, map: this.miniMap });

            const isObj = typeof restaurant === 'object' && restaurant !== null;
            const name  = isObj ? restaurant.place_name : restaurant;

            const content = `<div style="padding:5px 8px;font-size:12px;font-weight:700;white-space:nowrap;color:#333333;background:#ffffff;">${name}</div>`;

            this.infoWindow = new kakao.maps.InfoWindow({ content, removable: true });

            kakao.maps.event.addListener(marker, 'click', () => {
                this.infoWindow.open(this.miniMap, marker);
            });

            this.infoWindow.open(this.miniMap, marker);
        } catch (e) {
            el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.4);font-size:12px;">지도를 불러올 수 없어요</div>';
        }
    },

    navigateTo(lat, lng, name) {
        const url = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
        window.open(url, '_blank');
    }
};
