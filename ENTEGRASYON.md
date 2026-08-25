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

- Örnek: `public/aircraft-oml.glb` koyarsanız, uygulama içinden `/aircraft-oml.glb` ile erişilir.
- `public/` altındaki her şey kök yoldan (`/dosya.glb`) servis edilir.

> Model yüklenmiyorsa ilk kontrol: dosya gerçekten `public/` içinde mi ve adı
> registry'deki `modelUrl` ile birebir aynı mı?

---

## 3. modelUrl'i MANUEL ayarlama (sizin 1. isteğiniz)

Backend uçak verisinde `modelUrl` **döndürmüyor**. Hangi uçağın hangi modeli
kullanacağı tek bir dosyada manuel tanımlanır:

**Dosya: `src/config/modelRegistry.ts`**

Eşleme önceliği (yukarıdan aşağı):
1. Backend `modelUrl` döndürdüyse o kullanılır (ileride backend eklerse otomatik).
2. `byAircraftId` → belirli bir uca (tail) özel model.
3. `byModel` → uçağın `aircraftModel` alanına göre (örn. `"OML"`).
4. `DEFAULT` → hiçbiri yoksa.

### Yeni bir model eklemek için:

```ts
// src/config/modelRegistry.ts içinde byModel:
byModel: {
  OML:    { modelUrl: '/aircraft-oml.glb', viewConfig: OML_VIEW_CONFIG },
  'F-16': { modelUrl: '/models/F-16.glb', viewConfig: { /* ... */ } }
}
```

- `'F-16'` anahtarı, backend'den gelen `aircraft.aircraftModel` ile **birebir** eşleşmeli.
- Tek bir uçağa özel model için `byAircraftId['aircraft-7'] = { modelUrl, viewConfig }`.

> Bu zenginleştirme `src/api/fleet.ts` içinde `attachModel()` ile otomatik uygulanır;
> `HmsViewerPage.vue` veya `HmsViewer.vue` tarafında değişiklik yapmanıza gerek yoktur.

## 3.1 Ekipman (LRU) modelleri — çok modelli görüntüleme

Uçağın tamamını tek bir GLB'de tutmak mümkün değil. Bu yüzden model iki katmana ayrılır:

- **Dış kabuk:** Adım 3'teki `modelUrl` (tek dosya, uçağın gövdesi).
- **Ekipmanlar:** her LRU için **ayrı** bir GLB dosyası.

Bir uçuşta hangi FIN'lerde arıza varsa, dış kabukla birlikte **yalnızca o ekipmanların**
modelleri yüklenir. Kullanıcı yan panelden arızasız ekipmanları da elle açabilir.

### İki paketleme biçimi

Ekipmanlar iki şekilde paketlenebilir; ikisi de aynı anda kullanılabilir:

**1) LRU başına bir dosya**

```
public/XXX2400MG001-missileRight.glb
```

**2) Chapter başına tek dosya** — birden fazla LRU'yu barındırır, ayrım node adlarından
yapılır:

```
public/ATA-27.glb
  ATA27                        <- gövde node'u, FIN taşımaz, yok sayılır
    _FLT2700CM001-ACTUATOR1
    _FLT2700CM002-ACTUATOR2
    _FLT2700CM003-ACTUATOR3
```

### Adlandırma sözleşmesi (hem dosya adı hem node adı)

```
XXX2400MG001-missileRight
^^^ tag (önemsiz)
   ^^^^^^^^^ FIN numarası — MFL kaydındaki finNumber ile eşleşir
   ^^ ATA chapter kodu
             ^^^^^^^^^^^^ panelde gösterilecek ad
```

Kural: baştaki rakam olmayan karakterler atılır, ilk tireye kadarı FIN'dir, FIN'in ilk iki
hanesi ATA chapter'dır.

Karar sırası: **dosya adı** kalıba uyuyorsa dosyanın tamamı o LRU'dur. Uymuyorsa dosyanın
içindeki **node adlarına** bakılır ve kalıba uyan her node bağımsız bir LRU olur. İkisi de
tutmazsa dosya ekipman sayılmaz (dış kabuk gibi).

Chapter dosyasından tek bir LRU gerektiğinde yalnızca o node'un alt ağacı sahneye alınır;
aynı dosyadan birden fazla LRU gerekiyorsa dosya bir kez indirilip bir kez ayrıştırılır.

### Dosya listesi elle tutulmaz

`npm run models:scan` `public/` klasörünü tarar ve `src/config/generatedLruModels.ts`
dosyasını üretir. Bu script `npm run dev` ve `npm run build` öncesi **otomatik** çalışır
(`predev` / `prebuild`). Yeni bir ekipman eklemek için dosyayı klasöre koymak yeterlidir;
kod değişikliği gerekmez.

Dosyalar doğrudan `public/` altındaysa tüm uçaklar için geçerli sayılır. Uçak modeline göre
ayırmak isterseniz `public/models/<uçakModeli>/...` düzenini kullanın; klasör adı kapsam
(`group`) olarak kaydedilir.

Backend ileride FIN başına model URL'i döndürmeye başlarsa değişmesi gereken tek yer
`resolveLruModels()` (`src/config/ataChapterRegistry.ts`) olur.

### Konum bilgisi ve hizalama
Ekipman modelleri gerçek uçak tasarımından export edildiği için **uçağın kendi koordinat
sisteminde** gelir. Görüntüleyici her mesh'in world matrisini geometriye bake ettiği için
dosyalar aynı sahneye yüklendiğinde kendiliğinden doğru yerlerine oturur; elle hizalama
yapılmaz. Şart tek: tüm dosyalar aynı orijin ve ölçekle export edilmiş olmalı.

Bunu doğrulamak için: `npm run models:inspect public/aircraft-oml.glb public/XXX2400MG001-missileRight.glb`
Her dosyanın dünya koordinatlarındaki sınır kutusunu basar; ekipmanların kutuları kabuğun
kutusunun içinde kalmalıdır.

Bunun kazancı şu: bir ekipman değiştiğinde veya yeri kaydığında koca uçak modelini değil,
sadece o ekipmanın GLB'sini değiştirmek yeterli.

### Arıza → ekipman eşlemesi
Arıza vurgusu ve izolasyon **kaynak bazlı** çalışır: bir LRU'nun tüm mesh'leri o LRU'nun
FIN'i ile etiketlenir, `2400MG001` arızalıysa o etiketi taşıyan her şey kırmızıya boyanır.
Bir ekipmanın herhangi bir alt parçasına tıklamak da ekipmanın tamamını seçer.

Bu, LRU'nun kendi dosyası olması ile chapter dosyası içinde bir node olması arasında fark
gözetmez. CAD export'ları alt şekilleri `COMPOUND007` gibi adlandırdığı için bu adlara
dayanan bir eşleşme zaten mümkün değil; anlamlı olan tek kimlik FIN.

ATA chapter kodu sırayla şuradan çözülür (bkz. `resolveAtaChapter`, `src/api/mfl.ts`):
1. MFL kaydındaki `ataChapter` alanı (backend eklediğinde tek doğru kaynak).
2. FIN'in ilk iki hanesi — `"2400MG001"` → `"24"`. Asıl sözleşme budur.
3. `faultCode`'un ilk iki hanesi — `"32-021"` → `"32"`. Eski kayıtlar için yedek.

### Görüntüleme davranışı
- Ekipman modeli görünürken dış kabuk otomatik **yarı saydam** olur; başlıktaki
  `Solid shell` / `Ghost shell` butonuyla değiştirilebilir.
- **Dış kabuk tıklanamaz**, yalnızca görsel bağlamdır. Tıklama ve hover sadece ekipman
  modellerini hedefler; böylece bir tık öndeki gövde yüzeyine takılmaz.
- Bir ekipmanın herhangi bir alt parçasına tıklamak **ekipmanın tamamını** seçer, içindeki
  `COMPOUND###` parçasını değil.
- Kamera her zaman **dış kabuğun** sınır kutusuna göre çerçevelenir; yüklü ekipman sayısı
  değişse de uçak ekranda aynı boyutta kalır. Yakın/uzak kesme düzlemleri ve yakınlaşma
  sınırları modelin ölçeğine göre ayarlanır (bu CAD modelleri ~0.4 birim büyüklüğünde).
- GLB dosyası bulunamayan ekipman panelde `no model` olarak devre dışı görünür,
  görüntüleyici çalışmaya devam eder.

---

### viewConfig nedir?
Her uçağın kamera açısı/model yönü farklı olabilir. `viewConfig` ile ince ayar:
- `modelRotation` : modeli döndür (radyan). OML modeli CAD'den Z-up geldiği için `x: -Math.PI / 2`.
- `cameraOffset`  : kameranın modele göre yönü.
- `zoom`          : `fullModel` / `part` / `assembly` yakınlaşma çarpanları.
- `swapFrontBack` : ViewCube FRONT/BACK etiketlerini takas eder.

Varsayılanlar: `src/three/defaultView.ts`.

---

## 4. Gerçek backend'e bağlama

> **HİBRİT MOD (mevcut kurulum):**
> - **Backend'den (gerçek veri):** Filo listesi → Uçak listesi → Uçuş listesi.
> - **Mock'tan (geçici):** MFL/arıza verisi. Çünkü backend şu an `finNumber`'ı boş
>   döndürüyor. MFL servisi `forceMock: true` ile her zaman `public/mock-api/mfl-by-flight.json`
>   dosyasından okur (bkz. `src/api/mfl.ts`).
> - **LRU:** Kullanılmıyor (görüntüleyiciye boş geçiliyor).
>
> Gerçek backend `flightId`'leri mock dosyadaki anahtarlarla eşleşmediği için, MFL araması
> şu sırayla çalışır: **flightId tam eşleşme → `default` anahtarı → ilk uçuş.** Yani seçtiğiniz
> herhangi bir gerçek uçuş, `mfl-by-flight.json` içindeki `"default"` arıza setini gösterir.
> İsterseniz gerçek `flightId`'leri JSON'a anahtar olarak ekleyip uçuşa özel arıza verebilirsiniz.
>
> Backend MFL'i (dolu `finNumber` ile) döndürmeye başlayınca: `src/api/mfl.ts` içindeki
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
| `fleet.ts` | `GET /api/fleet/find-all?page=0&size=20` | `{ content: [{id,name}], totalElements, totalPages, number, size }` |
| `fleet.ts` | `GET /api/aircraft/find-by-fleet-id/{fleetId}` | `[{ id, aircraftModel, name, tailNumber }]` |
| `fleet.ts` | `GET /api/aircraft/{aircraftId}` | `{ id, aircraftModel, name, tailNumber }` |
| `flight.ts` | `GET /api/flight/find-by-aircraft-id/{aircraftId}` | `[{ id, flightNo }]` |
| `mfl.ts` | _(şimdilik mock — backend çağrısı yapılmaz)_ | `{ mflDataList: [ { finNumber, ... } ] }` |

> Filo/uçak/uçuş uçları gerçek backend'den okunur. **MFL ucu şu an çağrılmıyor**;
> veri mock'tan gelir (bkz. yukarıdaki Hibrit Mod kutusu).

Kritik nokta — **`finNumber` = 3D modeldeki parça (glTF node) adı.** Kırmızı vurgu
bu eşleşmeyle yapılır. Mock'taki (ileride backend'deki) `finNumber` ile model
dosyasındaki parça adı **birebir** aynı olmalı (örn. `"Left engine"`).

> `modelUrl` backend'de YOK; adım 3'teki registry'den gelir.
> Backend yol adlarınız farklıysa ilgili `src/api/*.ts` dosyasındaki `apiPath`
> stringlerini güncelleyin (mock yolu ile gerçek yol ayrı parametrelerdir).

### 4.3 Token / Authorization
Bu modül **kendi token yönetimini yapmaz.** Gerçek istekler `src/api/http.ts`
üzerindeki ortak HTTP istemcisinden geçer; `Authorization` header'ı, base URL ve
401 yenileme akışı o istemcinin sorumluluğundadır.

Standalone çalışırken `src/api/http.ts` kendi axios örneğini kurar. Ana projeye
entegre ederken **yalnızca bu dosyanın içeriğini** ana projenin ortak istemcisini
dışa verecek şekilde değiştirin:

```ts
// src/api/http.ts
export { default as http } from '@/api/client'   // ana projenin ortak istemcisi
export const BASE_URL = ''
```

Servis dosyalarının (`fleet.ts`, `flight.ts`, `mfl.ts`, `lru.ts`) hiçbirine
dokunmanız gerekmez.

> Mock okumaları statik dosya olduğu için ortak istemciden geçmez; `hms-client.ts`
> içinde düz `fetch` ile yapılır (bu isteklere token/baseURL eklenmemeli).

---

## 5. Ana projeye entegrasyon — `index.ts` için dikkat edilecekler (sizin 4. isteğiniz)

Bu proje kendi `main.ts`'i ile `#app` öğesine mount olan bağımsız bir Vue SPA'sıdır.
Ana proje (TypeScript / `index.ts`) ile birleştirirken en sık yaşanan sorunlar:

### 5.1 Mount noktası ve tekil Vue örneği
- Bu uygulama `src/main.ts` içinde `createApp(App).use(router).mount('#app')` yapar.
- Ana projede de bir Vue örneği varsa **iki ayrı `createApp` çakışabilir**.
  - Aynı Vue uygulamasına gömüyorsanız: `main.ts`'i kullanmayın; `App.vue` +
    `router`'ı ana uygulamanın `createApp`'ine entegre edin.
  - Farklı/izole tutmak istiyorsanız: ayrı bir DOM düğümüne kendi `createApp`'iyle
    mount edin (mount id'sini `#app` dışında benzersiz bir şey yapın).

### 5.2 Router çakışması (EN KRİTİK)
- Bu proje `createWebHistory` (HTML5 history) kullanır ve `/`, `/view/:id/:flightId`,
  `/import` yollarını tanımlar.
- Ana projenin kendi router'ı varsa:
  - Yolları bir önek altına alın (örn. `/hms/...`) ya da bu rotaları ana router'a
    **child route** olarak ekleyin.
  - Alt yolda sunum yapacaksanız `vite.config.ts` içine `base: '/hms/'` ekleyin;
    router zaten `import.meta.env.BASE_URL` okuduğu için otomatik uyumludur (bkz. adım 6).

### 5.3 Asset (model) yolu
- Kod model yolunu kök (`/aircraft-oml.glb`) varsayar. Ana uygulama alt yolda sunuluyorsa
  (`/hms/`) bu yol kırılır. Çözüm: `base`'i doğru ayarlayın **ve** registry'deki
  `modelUrl`'i `import.meta.env.BASE_URL` ile birleştirin ya da modelleri host'un
  kökünde servis edin.

### 5.4 Global CSS sızıntısı
- `src/App.vue` içindeki stil **scoped DEĞİL** — `body`, `#app` gibi global seçiciler içerir.
- Ana uygulamaya gömerken bu stiller host sayfayı etkileyebilir. Gömme senaryosunda
  bu global stilleri scoped hale getirin veya bir kapsayıcı sınıf altına alın.

### 5.5 TypeScript tarafı
- Bu proje TypeScript (`.ts`/`.vue`) ve `strict` modda derlenir (`npm run type-check`).
- Tip tanımları `src/types/*-types.ts` altında toplanmıştır.
- `import.meta.env` için Vite ortamı şarttır (host da Vite değilse build araçları farklılaşır).

### 5.6 Bağımlılıklar
- `three`, `three-viewport-gizmo`, `vue-router`, `axios` host projede de kurulu olmalı.
  Sürüm çakışmalarına dikkat (özellikle `three` — `examples/jsm` import'ları sürüme bağlı).
- `axios` yalnızca standalone çalışırken `src/api/http.ts` içinde kullanılır; ana projeye
  entegre edilince o dosya ortak istemciyi dışa verdiği için doğrudan bağımlılık kalmaz.

> **Pratik öneri:** En düşük riskli yol, bu uygulamayı ayrı build edip ana uygulamaya
> bir **iframe** ya da ayrı route/micro-frontend olarak gömmektir. Kod paylaşımı
> gerekmiyorsa router/CSS çakışmalarının çoğu böylece ortadan kalkar.

---

## 6. Alt yolda sunum (base path) — gerekiyorsa

`vite.config.ts`:
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
| modelUrl / model eşleme (manuel) | `src/config/modelRegistry.ts` |
| Ekipman (LRU) GLB çözümleme + ATA chapter adları | `src/config/ataChapterRegistry.ts` |
| Ekipman dosya listesi (otomatik üretilir) | `src/config/generatedLruModels.ts` |
| `public/` tarama script'i (dosya + node adlarından FIN çıkarır) | `scripts/scan-models.mjs` |
| GLB doğrulama (node adları + dünya sınırları) | `scripts/inspect-glb.mjs` |
| **Ortak HTTP istemcisine bağlantı noktası** (entegrasyonda değişen tek dosya) | `src/api/http.ts` |
| Mock ↔ gerçek geçişi (`fetchJson`) | `src/api/hms-client.ts` |
| Filo & uçak servisleri | `src/api/fleet.ts` |
| Uçuş servisi | `src/api/flight.ts` |
| MFL (arıza) servisi + normalize | `src/api/mfl.ts` |
| LRU servisi | `src/api/lru.ts` |
| Tip tanımları | `src/types/api-types.ts`, `src/types/view-types.ts` |
| Seçim ekranı (filo→uçak→uçuş) | `src/views/HmsEntry.vue` |
| Görüntüleyici sayfası (veriyi toplar) | `src/views/HmsViewerPage.vue` |
| 3D motor + arıza vurgu + izolasyon | `src/components/HmsViewer.vue` |
| Kamera/yön varsayılanları | `src/three/defaultView.ts` |
| Rotalar | `src/router/index.ts` |
| Mock JSON'lar | `public/mock-api/*.json` |

---

## 8. Eksikler ve öneriler (sizin 3. isteğiniz)

**Şu an eksik / dikkat edilmesi gerekenler:**

1. **Model dosyaları repoda yok.** `public/aircraft-oml.glb` ve ekipman GLB'lerini elle
   eklemelisiniz (adım 2). Aksi halde görüntüleyici boş açılır.
2. **`finNumber` ↔ ekipman adı eşleşmesi.** Backend'in `finNumber` değeri, ekipman modelinin
   adındaki FIN ile birebir aynı olmalı — dosya adı (`2400MG001` ↔ `XXX2400MG001-*.glb`) ya
   da node adı (`2700CM002` ↔ `_FLT2700CM002-ACTUATOR2`). Farklıysa o ekipman yüklenmez ve
   kırmızı vurgu çalışmaz.
   *Öneri:* Backend ekibiyle FIN biçimini (büyük/küçük harf, dolgu sıfırları) baştan netleştirin.
3. **LRU kullanılmıyor (karar).** `HmsViewerPage.vue` görüntüleyiciye `:lru-list="[]"`
   geçer; LRU paneli boş olduğundan render edilmez. `src/api/lru.ts` ileride lazım
   olursa diye duruyor, çağrılmıyor.
4. **Hata/boş durum mesajları kısmen Türkçe-İngilizce karışık.** Tek dile sabitlenebilir.
5. **Draco/meshopt sıkıştırma.** Modeliniz sıkıştırılmışsa `GLTFLoader`'a `DRACOLoader`
   tanımlamak gerekir (`src/components/HmsViewer.vue`). Şu an tanımlı değil.
6. **Auth tamamen host uygulamanın işi.** Bu modül token eklemez; `src/api/http.ts`
   ana projenin ortak istemcisine bağlanır ve 401 yenileme akışı oradan gelir.
7. **Test yok.** Kritik akış (registry eşleme, mfl→fault dönüşümü) için birkaç birim testi
   ileride faydalı olur.

**"Şunu da yapsak iyi olur" dediklerim:**
- `aircraftModel` adlarının backend ile sözleşmesini dokümana eklemek (registry eşleşmesi buna bağlı).
- Gömme senaryosu için `App.vue` global stillerini scoped'a çekmek (adım 5.4).
- Backend MFL hazır olunca `src/api/mfl.ts`'teki `forceMock`'u kaldırma adımını unutmamak.

> Bunlardan herhangi birini hemen yapmamı isterseniz söyleyin; özellikle **App.vue
> stillerini izole etme** gömme için hızlı bir kazanım.

---

## 9. Sık karşılaşılan sorunlar (hızlı checklist)

- **Model açılmıyor:** Dosya `public/` içinde mi? `modelUrl` adı birebir doğru mu?
- **Kırmızı vurgu yok:** Backend `finNumber` ≠ model node adı. Adları karşılaştırın.
- **Boş liste/404:** `.env` doğru mu? `VITE_API_BASE_URL` ulaşılabilir mi? Mock'a düşmüş olabilir.
- **Alt yolda asset 404:** `vite.config.ts` `base` ayarı + model yolu (adım 5.3/6).
- **Stil bozulması (host'ta):** `App.vue` global stilleri (adım 5.4).
