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

            const isObj    = typeof restaurant === 'object' && restaurant !== null;
            const name     = isObj ? restaurant.place_name : restaurant;
            const address  = isObj ? (restaurant.road_address_name || restaurant.address_name || '') : '';
            const addrSub  = isObj && restaurant.road_address_name ? (restaurant.address_name || '') : '';
            const phone    = isObj ? (restaurant.phone || '') : '';
            const placeUrl = isObj ? (restaurant.place_url || '') : '';
            const naviUrl  = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;

            const nameHtml = placeUrl
                ? `<a href="${placeUrl}" target="_blank" style="font-size:15px;font-weight:700;color:#222;text-decoration:none;">${name}&nbsp;<span style="color:#3399ff;font-size:15px;font-weight:400;">›</span></a>`
                : `<span style="font-size:15px;font-weight:700;color:#222;">${name}</span>`;

            const content = `
<div style="font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#fff;min-width:240px;max-width:280px;overflow:hidden;color:#222;line-height:1;">
  <div style="padding:14px 14px 10px;">
    <div style="margin-bottom:8px;">${nameHtml}</div>
    ${address  ? `<div style="color:#555;font-size:12px;line-height:1.55;margin-bottom:2px;">${address}</div>` : ''}
    ${addrSub  ? `<div style="color:#999;font-size:11px;margin-bottom:6px;">${addrSub}</div>` : ''}
    ${phone    ? `<div style="color:#0a9;font-size:12px;font-weight:600;margin-bottom:6px;">${phone}</div>` : ''}
    <div style="display:flex;align-items:center;gap:6px;padding-top:8px;border-top:1px solid #f0f0f0;">
      ${placeUrl ? `<a href="${placeUrl}" target="_blank" style="color:#555;font-size:11px;text-decoration:none;">상세보기</a><span style="color:#ddd;font-size:11px;padding:0 2px;">|</span>` : ''}
      <a href="${placeUrl || 'javascript:void(0)'}" target="_blank" style="color:#555;font-size:11px;text-decoration:none;">정보 수정 제안</a>
    </div>
  </div>
  <div style="padding:8px 14px 10px;display:flex;align-items:center;justify-content:flex-end;border-top:1px solid #f0f0f0;gap:10px;">
    <span style="font-size:18px;cursor:pointer;color:#aaa;" title="즐겨찾기">🔖</span>
    <span style="font-size:18px;cursor:pointer;color:#aaa;" title="공유">↗</span>
    <a href="${naviUrl}" target="_blank" style="background:#3399ff;color:#fff;border-radius:6px;padding:7px 14px;font-size:12px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">🗺️ 길찾기</a>
  </div>
</div>`;

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
