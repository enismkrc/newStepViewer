# HMS 3D Viewer — Entegrasyon Rehberi (Adım Adım)

> Bu rehber, projeyi **hiç bilmeyen** birinin sıfırdan çalıştırıp ana uygulamaya
> entegre edebilmesi için yazılmıştır. Sırayla takip edin.

---

## 0. Bu uygulama ne yapıyor? (30 saniyelik özet)

Akış: **Filo seç → Uçak seç → Uçuş seç → 3D model görüntüleyici açılır.**

Görüntüleyici:
- Uçağın 3D modelini (`.glb` / `.gltf`) yükler.
- O uçuşa ait **arızalı parçaları** (MFL/FIN verisi) modelde **kırmızı** boyar.
- Parçaya tıklayınca o parçayı **izole edip yakınlaşır**, yan panelde LRU/MFL detayını gösterir.

Teknoloji: **Vue 3 + Vite + Three.js**. Veri katmanı mock JSON veya gerçek backend olabilir.

---

## 1. Kurulum ve çalıştırma (mock mod — backend gerekmez)

```sh
npm install
npm run dev
```

Açılan adreste (genelde `http://localhost:5173`) uygulama mock veriyle çalışır.
Hiçbir backend kurmadan tüm akışı görebilirsiniz.

> Mock veriler `public/mock-api/*.json` içindedir. Gerçek backend'in döneceği JSON
> şekillerini buradan inceleyebilirsiniz.

---

## 2. 3D model dosyasını yerleştirme (ÖNEMLİ)

Model dosyaları repoya dahil **değildir** (büyük binary). Kendi `.gltf`/`.glb`
dosyanızı `public/` klasörüne koymanız gerekir.

- Örnek: `public/KF-21.gltf` koyarsanız, uygulama içinden `/KF-21.gltf` ile erişilir.
- `public/` altındaki her şey kök yoldan (`/dosya.gltf`) servis edilir.

> Model yüklenmiyorsa ilk kontrol: dosya gerçekten `public/` içinde mi ve adı
> registry'deki `modelUrl` ile birebir aynı mı?

---

## 3. modelUrl'i MANUEL ayarlama (sizin 1. isteğiniz)

Backend uçak verisinde `modelUrl` **döndürmüyor**. Hangi uçağın hangi modeli
kullanacağı tek bir dosyada manuel tanımlanır:

**Dosya: `src/config/modelRegistry.js`**

Eşleme önceliği (yukarıdan aşağı):
1. Backend `modelUrl` döndürdüyse o kullanılır (ileride backend eklerse otomatik).
2. `byAircraftId` → belirli bir uca (tail) özel model.
3. `byModel` → uçağın `aircraftModel` alanına göre (örn. `"KF-21"`).
4. `DEFAULT` → hiçbiri yoksa.

### Yeni bir model eklemek için:

```js
// src/config/modelRegistry.js içinde byModel:
byModel: {
  'KF-21': { modelUrl: '/KF-21.gltf', viewConfig: KF21_VIEW_CONFIG },
  'F-16':  { modelUrl: '/models/F-16.gltf', viewConfig: { /* ... */ } }
}
```

- `'F-16'` anahtarı, backend'den gelen `aircraft.aircraftModel` ile **birebir** eşleşmeli.
- Tek bir uçağa özel model için `byAircraftId['aircraft-7'] = { modelUrl, viewConfig }`.

> Bu zenginleştirme `src/api/fleet.js` içinde `attachModel()` ile otomatik uygulanır;
> `HmsViewerPage.vue` veya `HmsViewer.vue` tarafında değişiklik yapmanıza gerek yoktur.

### viewConfig nedir?
Her uçağın kamera açısı/model yönü farklı olabilir. `viewConfig` ile ince ayar:
- `modelRotation` : modeli döndür (radyan). KF-21'de burun -Z'ye baktığı için `y: Math.PI`.
- `cameraOffset`  : kameranın modele göre yönü.
- `zoom`          : `fullModel` / `part` / `assembly` yakınlaşma çarpanları.
- `swapFrontBack` : ViewCube FRONT/BACK etiketlerini takas eder.

Varsayılanlar: `src/three/defaultView.js`.

---

## 4. Gerçek backend'e bağlama

> **HİBRİT MOD (mevcut kurulum):**
> - **Backend'den (gerçek veri):** Filo listesi → Uçak listesi → Uçuş listesi.
> - **Mock'tan (geçici):** MFL/arıza verisi. Çünkü backend şu an `finNumber`'ı boş
>   döndürüyor. MFL servisi `forceMock: true` ile her zaman `public/mock-api/mfl-by-flight.json`
>   dosyasından okur (bkz. `src/api/mfl.js`).
> - **LRU:** Kullanılmıyor (görüntüleyiciye boş geçiliyor).
>
> Gerçek backend `flightId`'leri mock dosyadaki anahtarlarla eşleşmediği için, MFL araması
> şu sırayla çalışır: **flightId tam eşleşme → `default` anahtarı → ilk uçuş.** Yani seçtiğiniz
> herhangi bir gerçek uçuş, `mfl-by-flight.json` içindeki `"default"` arıza setini gösterir.
> İsterseniz gerçek `flightId`'leri JSON'a anahtar olarak ekleyip uçuşa özel arıza verebilirsiniz.
>
> Backend MFL'i (dolu `finNumber` ile) döndürmeye başlayınca: `src/api/mfl.js` içindeki
> `{ forceMock: true }` satırını kaldırın — başka değişiklik gerekmez.

### 4.1 Ortam değişkenleri
`.env.example` dosyasını `.env` olarak kopyalayın:

```sh
# PowerShell
Copy-Item .env.example .env
```

`.env` içeriği:
```
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8080
```

> `VITE_USE_MOCK_API=true` bırakılırsa veya `VITE_API_BASE_URL` boşsa uygulama
> mock moda düşer. Tek satır değiştirerek mock ↔ gerçek backend geçişi yapılır.

### 4.2 Backend'in döndürmesi gereken JSON sözleşmesi

Tüm istekler `src/api/` altındaki servislerden geçer. Beklenen uçlar:

| Servis dosyası | Endpoint | Dönen şekil |
|---|---|---|
| `fleet.js` | `GET /api/fleet/find-all?page=0&size=20` | `{ content: [{id,name}], totalElements, totalPages, number, size }` |
| `fleet.js` | `GET /api/aircraft/find-by-fleet-id/{fleetId}` | `[{ id, aircraftModel, name, tailNumber }]` |
| `fleet.js` | `GET /api/aircraft/{aircraftId}` | `{ id, aircraftModel, name, tailNumber }` |
| `flight.js` | `GET /api/flight/find-by-aircraft-id/{aircraftId}` | `[{ id, flightNo }]` |
| `mfl.js` | _(şimdilik mock — backend çağrısı yapılmaz)_ | `{ mflDataList: [ { finNumber, ... } ] }` |

> Filo/uçak/uçuş uçları gerçek backend'den okunur. **MFL ucu şu an çağrılmıyor**;
> veri mock'tan gelir (bkz. yukarıdaki Hibrit Mod kutusu).

Kritik nokta — **`finNumber` = 3D modeldeki parça (glTF node) adı.** Kırmızı vurgu
bu eşleşmeyle yapılır. Mock'taki (ileride backend'deki) `finNumber` ile model
dosyasındaki parça adı **birebir** aynı olmalı (örn. `"Left engine"`).

> `modelUrl` backend'de YOK; adım 3'teki registry'den gelir.
> Backend yol adlarınız farklıysa ilgili `src/api/*.js` dosyasındaki `apiPath`
> stringlerini güncelleyin (mock yolu ile gerçek yol ayrı parametrelerdir).

### 4.3 Token / Authorization (gerekiyorsa)
`src/api/client.js` içinde hazır kancalar var:

```js
import { setAuthToken } from '@/api/client'
setAuthToken(token)              // tüm isteklere Authorization: Bearer <token> ekler
// veya
import { setHeaders } from '@/api/client'
setHeaders({ 'X-Tenant': 'acme' })
```

Bunu ana uygulamanın giriş/oturum akışından sonra bir kez çağırmanız yeterli.

---

## 5. Ana projeye entegrasyon — `index.ts` için dikkat edilecekler (sizin 4. isteğiniz)

Bu proje kendi `main.js`'i ile `#app` öğesine mount olan bağımsız bir Vue SPA'sıdır.
Ana proje (TypeScript / `index.ts`) ile birleştirirken en sık yaşanan sorunlar:

### 5.1 Mount noktası ve tekil Vue örneği
- Bu uygulama `src/main.js` içinde `createApp(App).use(router).mount('#app')` yapar.
- Ana projede de bir Vue örneği varsa **iki ayrı `createApp` çakışabilir**.
  - Aynı Vue uygulamasına gömüyorsanız: `main.js`'i kullanmayın; `App.vue` +
    `router`'ı ana uygulamanın `createApp`'ine entegre edin.
  - Farklı/izole tutmak istiyorsanız: ayrı bir DOM düğümüne kendi `createApp`'iyle
    mount edin (mount id'sini `#app` dışında benzersiz bir şey yapın).

### 5.2 Router çakışması (EN KRİTİK)
- Bu proje `createWebHistory` (HTML5 history) kullanır ve `/`, `/view/:id/:flightId`,
  `/import` yollarını tanımlar.
- Ana projenin kendi router'ı varsa:
  - Yolları bir önek altına alın (örn. `/hms/...`) ya da bu rotaları ana router'a
    **child route** olarak ekleyin.
  - Alt yolda sunum yapacaksanız `vite.config.js` içine `base: '/hms/'` ekleyin;
    router zaten `import.meta.env.BASE_URL` okuduğu için otomatik uyumludur (bkz. adım 6).

### 5.3 Asset (model) yolu
- Kod model yolunu kök (`/KF-21.gltf`) varsayar. Ana uygulama alt yolda sunuluyorsa
  (`/hms/`) bu yol kırılır. Çözüm: `base`'i doğru ayarlayın **ve** registry'deki
  `modelUrl`'i `import.meta.env.BASE_URL` ile birleştirin ya da modelleri host'un
  kökünde servis edin.

### 5.4 Global CSS sızıntısı
- `src/App.vue` içindeki stil **scoped DEĞİL** — `body`, `#app` gibi global seçiciler içerir.
- Ana uygulamaya gömerken bu stiller host sayfayı etkileyebilir. Gömme senaryosunda
  bu global stilleri scoped hale getirin veya bir kapsayıcı sınıf altına alın.

### 5.5 TypeScript tarafı
- Bu proje JavaScript (`.js`/`.vue`). Ana proje TS ise:
  - `.vue` dosyaları için host'ta `vue-tsc`/`shims-vue.d.ts` ayarı gerekebilir.
  - `import.meta.env` için Vite ortamı şarttır (host da Vite değilse build araçları farklılaşır).

### 5.6 Bağımlılıklar
- `three`, `three-viewport-gizmo`, `vue-router` host projede de kurulu olmalı.
  Sürüm çakışmalarına dikkat (özellikle `three` — `examples/jsm` import'ları sürüme bağlı).

> **Pratik öneri:** En düşük riskli yol, bu uygulamayı ayrı build edip ana uygulamaya
> bir **iframe** ya da ayrı route/micro-frontend olarak gömmektir. Kod paylaşımı
> gerekmiyorsa router/CSS çakışmalarının çoğu böylece ortadan kalkar.

---

## 6. Alt yolda sunum (base path) — gerekiyorsa

`vite.config.js`:
```js
export default defineConfig({
  base: '/hms/',   // uygulama https://site.com/hms/ altında sunulacaksa
  // ...
})
```
Router otomatik uyumludur (`createWebHistory(import.meta.env.BASE_URL)`).

---

## 7. Dosya haritası (nereyi açmalı?)

| İhtiyaç | Dosya |
|---|---|
| modelUrl / model eşleme (manuel) | `src/config/modelRegistry.js` |
| HTTP istemcisi, mock/gerçek geçiş, token | `src/api/client.js` |
| Filo & uçak servisleri | `src/api/fleet.js` |
| Uçuş servisi | `src/api/flight.js` |
| MFL (arıza) servisi + normalize | `src/api/mfl.js` |
| LRU servisi | `src/api/lru.js` |
| Seçim ekranı (filo→uçak→uçuş) | `src/views/HmsEntry.vue` |
| Görüntüleyici sayfası (veriyi toplar) | `src/views/HmsViewerPage.vue` |
| 3D motor + arıza vurgu + izolasyon | `src/components/HmsViewer.vue` |
| Kamera/yön varsayılanları | `src/three/defaultView.js` |
| Rotalar | `src/router/index.js` |
| Mock JSON'lar | `public/mock-api/*.json` |

---

## 8. Eksikler ve öneriler (sizin 3. isteğiniz)

**Şu an eksik / dikkat edilmesi gerekenler:**

1. **Model dosyaları repoda yok.** `public/KF-21.gltf` gibi dosyaları elle eklemelisiniz
   (adım 2). Aksi halde görüntüleyici boş açılır.
2. **`finNumber` ↔ glTF parça adı eşleşmesi.** Backend'in `finNumber` değerleri model
   dosyasındaki node adlarıyla birebir aynı olmalı. Farklıysa kırmızı vurgu hiç çalışmaz.
   *Öneri:* Backend ekibiyle bu adların standardını (büyük/küçük harf, boşluk) baştan netleştirin.
3. **LRU kullanılmıyor (karar).** `HmsViewerPage.vue` görüntüleyiciye `:lru-list="[]"`
   geçer; LRU paneli boş olduğundan render edilmez. `src/api/lru.js` ileride lazım
   olursa diye duruyor, çağrılmıyor.
4. **Hata/boş durum mesajları kısmen Türkçe-İngilizce karışık.** Tek dile sabitlenebilir.
5. **Draco/meshopt sıkıştırma.** Modeliniz sıkıştırılmışsa `GLTFLoader`'a `DRACOLoader`
   tanımlamak gerekir (`src/components/HmsViewer.vue`). Şu an tanımlı değil.
6. **Auth yenileme (refresh token) yok.** `client.js` sabit token ekliyor; 401 durumunda
   otomatik yenileme akışı host uygulamadan gelmeli.
7. **Test yok.** Kritik akış (registry eşleme, mfl→fault dönüşümü) için birkaç birim testi
   ileride faydalı olur.

**"Şunu da yapsak iyi olur" dediklerim:**
- `aircraftModel` adlarının backend ile sözleşmesini dokümana eklemek (registry eşleşmesi buna bağlı).
- Gömme senaryosu için `App.vue` global stillerini scoped'a çekmek (adım 5.4).
- Backend MFL hazır olunca `src/api/mfl.js`'teki `forceMock`'u kaldırma adımını unutmamak.

> Bunlardan herhangi birini hemen yapmamı isterseniz söyleyin; özellikle **App.vue
> stillerini izole etme** gömme için hızlı bir kazanım.

---

## 9. Sık karşılaşılan sorunlar (hızlı checklist)

- **Model açılmıyor:** Dosya `public/` içinde mi? `modelUrl` adı birebir doğru mu?
- **Kırmızı vurgu yok:** Backend `finNumber` ≠ model node adı. Adları karşılaştırın.
- **Boş liste/404:** `.env` doğru mu? `VITE_API_BASE_URL` ulaşılabilir mi? Mock'a düşmüş olabilir.
- **Alt yolda asset 404:** `vite.config.js` `base` ayarı + model yolu (adım 5.3/6).
- **Stil bozulması (host'ta):** `App.vue` global stilleri (adım 5.4).
