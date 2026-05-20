const LocationService = {
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('UNSUPPORTED'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => reject(err),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        });
    },

    async getAddressFromCoords(lat, lng) {
        return new Promise((resolve) => {
            if (typeof kakao === 'undefined' || !kakao.maps?.services) {
                resolve('위치 확인됨');
                return;
            }
            try {
                const geocoder = new kakao.maps.services.Geocoder();
                geocoder.coord2RegionCode(lng, lat, (result, status) => {
                    if (status === kakao.maps.services.Status.OK) {
                        const dong = result.find(r => r.region_type === 'H');
                        const gu   = result.find(r => r.region_type === 'B');
                        resolve(dong ? dong.address_name : gu ? gu.address_name : '위치 확인됨');
                    } else {
                        resolve('위치 확인됨');
                    }
                });
            } catch (e) {
                resolve('위치 확인됨');
            }
        });
    }
};
