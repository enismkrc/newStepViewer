# 3D STEP Model Viewer – Proje Özeti ve Teknik Spesifikasyon

Bu belge, **sıfırdan** geliştirilen **tek sayfalık 3D CAD model görüntüleyici** uygulamasının amacını, kapsamını ve teknik gereksinimlerini tanımlar. Uygulama, kullanıcının STEP/IGES/BREP dosyalarını yükleyip 3D olarak görüntülemesine, parçalar üzerinde hover ile vurgulama yapmasına ve tıklayarak tek parça izolasyonuna olanak tanır.

---

## 1. Amaç ve Kapsam

- **Amaç:** Kullanıcının bir STEP (veya IGES/BREP) dosyası seçip tarayıcıda 3D modeli inceleyebildiği, parça bazlı etkileşim (hover highlight, tıklayınca sadece o parçayı gösterme) sunan, sade ve tek sayfalık bir web uygulaması.
- **Kapsam:** Sadece “model yükle → görüntüle → parça vurgula → parçaya tıkla → sadece o parça görünsün” akışı. Ek modüller (dönüştürme, bakım panelleri vb.) bu aşamada dahil değildir.

---

## 2. Teknoloji Yığını

- **Frontend:** Vue 3 (Composition API, `<script setup>`)
- **Build:** Vite
- **3D motor:** Three.js (sahne, kamera, WebGL renderer, OrbitControls)
- **CAD import:** occt-import-js (tarayıcıda STEP/IGES/BREP → mesh; WASM tabanlı)
- **Dil:** JavaScript (ES modules)

---

## 3. Temel Özellikler (Adım Adım)

### 3.1 Tek sayfa, sadece model görüntüleme
- Uygulama tek bir sayfadan oluşur: başlık, kontroller (dosya seç, görünümü sıfırla, tel kafes), durum mesajı alanı ve 3D görüntüleme alanı (canvas).
- Kullanıcı **STEP, STP, IGES, IGS veya BREP** dosyası seçer; dosya occt-import-js ile işlenir ve elde edilen mesh’ler Three.js sahnesine eklenir.
- Model yüklendikten sonra kamera, tüm modeli kadraja sığdıracak şekilde otomatik konumlandırılır (uzak zoom; modelin tamamı rahatça görünür).

### 3.2 Açık renk arka plan
- 3D sahne arka planı açık renktedir (örn. `#f3f4f6`).
- Canvas’ı saran “stage” alanının arka planı da açık tonlarda, hafif gradyan ile tutarlı bir görünüm sağlanır.

### 3.3 Parça üzerinde mouse ile vurgulama (hover highlight)
- Mouse imleci canvas üzerinde hareket ettiğinde, **raycaster** ile imlecin altındaki mesh tespit edilir.
- Üzerine gelinen parça (mesh) **vurgulanır:** hafif mavi emissive glow ve renkte hafif aydınlatma.
- İmleç parçadan çıkınca vurgulama kaldırılır; imleç parça üzerindeyken cursor `pointer` olur.

### 3.4 Tıklayınca sadece o parçayı gösterme (izolasyon)
- Kullanıcı bir parçaya (mesh’e) **tıkladığında:**
  - Sadece tıklanan parça görünür kalır; diğer tüm mesh’ler gizlenir (`visible = false`).
  - Kamera, bu tek parçanın bounding box’ına odaklanacak şekilde yeniden konumlandırılır (parça “yeniden açılmış” gibi, tek başına ekranda).
- **Geri dönüş:**
  - İzole modundayken **aynı parçaya tekrar tıklanırsa** veya üstte çıkan **“← Tümünü göster”** butonuna basılırsa tüm parçalar tekrar gösterilir ve kamera tüm modeli kapsayacak şekilde sıfırlanır.

---

## 4. Kullanıcı Akışları

1. **Sayfa açılır** → “Dosya seç” ile STEP/IGES/BREP seçilir → model yüklenir, canvas’ta 3D görünür, kamera otomatik fit edilir.
2. **Mouse parça üzerinde** → Parça highlight olur, cursor pointer.
3. **Parçaya tıklanır** → Sadece o parça kalır, kamera ona zoom yapar.
4. **Aynı parçaya tekrar tıklanır veya “Tümünü göster”** → Tüm parçalar görünür, kamera tüm modele fit edilir.
5. **Görünümü sıfırla** → Kamera yeniden tüm (görünür) modele fit edilir.
6. **Tel kafes / Katı** → Tüm mesh’lerde wireframe açılır/kapatılır.

---

## 5. Teknik Notlar

- **Bileşen:** Tek ana bileşen (örn. `StepUploadViewer.vue`) içinde Three.js sahnesi, occt-import-js ile dosya okuma, raycasting (hover + click), izolasyon ve “tümünü göster” mantığı toplanır.
- **State:** Model yüklü mü (`modelLoaded`), izole modda mı (`isIsolated`), izole edilmiş mesh hangisi (`isolatedMesh`) takip edilir; yeni dosya yüklendiğinde izolasyon sıfırlanır.
- **Kamera fit:** Bounding box + FOV ve aspect ratio kullanılarak mesafe hesaplanır; büyük modellerde “çok yakın” kalmaması için mesafe çarpanı yeterince büyük tutulur (örn. 4.0–4.6).
- **WASM:** occt-import-js için `.wasm` dosyası `public` klasöründe sunulur; `locateFile` ile kök yol (`/…`) verilir.
- **Temizlik:** Component unmount’ta animation frame iptali, resize/pointer event listener’ların kaldırılması, Three.js (renderer, controls, sahne) dispose edilir.

---

## 6. Prompt Özeti (Kopyala-Yapıştır)

Aşağıdaki blok, bu projeyi anlatmak veya aynı davranışı yeniden uygulatmak için kullanılabilir:

```
Vue 3 + Vite + Three.js + occt-import-js kullanarak tek sayfalık bir 3D STEP/IGES/BREP görüntüleyici yap. Özellikler:

1) Tek sayfa: Başlık, "Dosya seç" (STEP/STP/IGES/IGS/BREP), "Görünümü sıfırla", "Tel kafes/Katı" butonları; durum/dosya adı alanı; tek bir canvas ile 3D görüntüleme. occt-import-js ile dosyayı okuyup mesh'leri Three.js sahnesine ekle; kamera tüm modeli rahatça gösterecek uzaklıkta fit edilsin.

2) Açık renk arka plan: Sahne ve canvas alanı açık ton (#f3f4f6 benzeri).

3) Hover highlight: Mouse ile canvas üzerinde gezerken raycast ile altındaki mesh bulunsun; o parça mavi emissive glow ile vurgulansın, cursor pointer olsun; parçadan çıkınca vurgu kalksın.

4) Tıklayınca izolasyon: Bir parçaya (mesh'e) tıklanınca sadece o parça kalsın (diğer mesh'ler gizlensin), kamera o parçaya odaklansın. İzole modda iken aynı parçaya tekrar tıklanınca veya "Tümünü göster" butonuna basılınca tüm parçalar tekrar görünsün ve kamera tüm modele fit edilsin. Yeni dosya yüklendiğinde izolasyon sıfırlansın.

Tek bileşende (StepUploadViewer) tüm mantık toplansın; App.vue sadece bu bileşeni render etsin. Profesyonel, sade UI; event listener ve Three.js kaynakları unmount'ta temizlensin.
```

---

*Bu belge, projenin “model yükle → görüntüle → hover highlight → tıklayınca tek parça izolasyonu” aşamasına kadar olan kapsamını tanımlar.*
