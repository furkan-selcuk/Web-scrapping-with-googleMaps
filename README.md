# Google Maps Web Scraping Aracı

Bu proje, Google Maps üzerinden belirli şehirlerde ve sektörlerde firma bilgilerini otomatik olarak çekmek için geliştirilmiş bir web scraping aracıdır.

## Özellikler

- Belirli şehir ve sektörlere göre firma bilgisi toplama
- Firma adı, telefon numarası, e-posta, website ve adres bilgilerini çekme
- Verileri Excel formatında kaydetme
- Otomatik sayfa kaydırma ve yükleme
- Birden fazla şehir ve sektörde otomatik arama yapabilme

## Gereksinimler

- Node.js (v12+)
- npm paket yöneticisi

## Kurulum

1. Repoyu klonlayın:
git clone https://github.com/furkan-selcuk/Web-scrapping-with-googleMaps.git


2. Proje dizinine gidin:
cd Web-scrapping-with-googleMaps


3. Gerekli paketleri yükleyin:
npm install puppeteer fs xlsx


## Kullanım
1. Script içindeki şehir ve sektörleri düzenleyin.
2. `node googlemapsscrapping.js` komutu ile çalıştırın.
3. Sonuçlar Excel dosyasına kaydedilecektir.

## Yasal Uyarı

Bu araç eğitim amaçlıdır. Web sitelerinin kullanım şartlarına uygun davranın.
