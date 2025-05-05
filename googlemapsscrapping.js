const puppeteer = require('puppeteer');
const fs = require('fs');
const XLSX = require('xlsx');

async function autoScroll(page) {
    await page.evaluate(async () => {
        const wrapper = document.querySelector('div.ecceSd');
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        if (wrapper) {
            let lastCount = 0;
            let sameCountTimes = 0;
            
            for (let i = 0; i < 100; i++) {
                // Agresif scroll
                wrapper.scrollTo(0, wrapper.scrollHeight);
                await delay(500);
                
                // Yukarı scroll
                wrapper.scrollTo(0, wrapper.scrollHeight - 1000);
                await delay(500);
                
                // Tekrar aşağı
                wrapper.scrollTo(0, wrapper.scrollHeight);
                await delay(500);
                
                const items = document.querySelectorAll('div.Nv2PK').length;
                console.log(`Bulunan firma sayısı: ${items}`);
                
                if (items === lastCount) {
                    sameCountTimes++;
                    if (sameCountTimes >= 5) {
                        console.log('Daha fazla sonuç yüklenemedi.');
                        break;
                    }
                } else {
                    sameCountTimes = 0;
                    lastCount = items;
                }
            }
        }
    });
}

async function scrapeGoogleMaps(sehir, anahtarKelime) {
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });
    
    const page = await browser.newPage();
    
    // Bot algılamasını engellemek için gerekli ayarlar
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });
    
    try {
        // Google Maps arama URL'sini oluştur
        const searchQuery = `${anahtarKelime} ${sehir}`;
        const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        
        console.log('Sayfa yükleniyor...');
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
        await page.waitForTimeout(5000);

        // Sol taraftaki sonuç panelini bekle
        console.log('Sonuçlar yükleniyor...');
        await page.waitForSelector('div.ecceSd', { timeout: 30000 });
        
        const firmalar = [];
        let islemDevamEdiyor = true;
        let index = 0;
        let sonKayitIndex = 0;
        
        while (islemDevamEdiyor) {
            try {
                // Mevcut firma kartlarını bul
                const firmaKartlari = await page.$$('div.Nv2PK');
                
                // Eğer index mevcut firma sayısından büyükse, scroll yap ve bekle
                if (index >= firmaKartlari.length) {
                    // Scroll işlemi
                    await page.evaluate(() => {
                        const container = document.querySelector('div.ecceSd');
                        if (container) {
                            container.scrollTo(0, container.scrollHeight);
                        }
                    });
                    await page.waitForTimeout(2000);
                    
                    // Yeni kartları kontrol et
                    const yeniKartlar = await page.$$('div.Nv2PK');
                    if (yeniKartlar.length === firmaKartlari.length) {
                        // Yeni firma yüklenmediyse işlemi bitir
                        console.log('Daha fazla firma yüklenemedi, işlem tamamlanıyor...');
                        islemDevamEdiyor = false;
                        break;
                    }
                    continue;
                }
                
                // Firma kartını görünür yap
                await page.evaluate((idx) => {
                    const kartlar = document.querySelectorAll('div.Nv2PK');
                    if (kartlar[idx]) {
                        kartlar[idx].scrollIntoView({ behavior: 'instant', block: 'center' });
                    }
                }, index);
                
                await page.waitForTimeout(1000);
                
                // Firma kartına tıkla
                await firmaKartlari[index].click().catch(() => null);
                await page.waitForTimeout(2000);
                
                // Firma detaylarını al
                const firmaDetay = await page.evaluate(() => {
                    const isim = document.querySelector('h1.DUwDvf')?.textContent || '';
                    const adres = document.querySelector('button[data-item-id*="address"]')?.textContent || 
                                document.querySelector('div[data-item-id*="address"]')?.textContent || '';
                    
                    // Telefon numarasını bul
                    let telefon = '';
                    const telefonButton = document.querySelector('button[data-tooltip="Telefon numarasını kopyala"]');
                    if (telefonButton) {
                        telefon = telefonButton.getAttribute('aria-label')?.replace('Telefon numarası: ', '') || '';
                    }
                    if (!telefon) {
                        const telefonDiv = document.querySelector('div[data-item-id*="phone:tel:"]');
                        telefon = telefonDiv ? telefonDiv.textContent.trim() : '';
                    }
                    
                    // Website bul
                    let website = '';
                    const websiteLink = document.querySelector('a[data-item-id*="authority"]');
                    if (websiteLink) {
                        website = websiteLink.href || websiteLink.textContent || '';
                    }
                    
                    // Email bul
                    let email = '';
                    // Tüm metni al
                    const fullText = document.body.innerText;
                    // Email regex
                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                    const emailMatches = fullText.match(emailRegex);
                    if (emailMatches) {
                        email = emailMatches[0]; // İlk bulunan email adresini al
                    }
                    
                    // "E-posta" veya "Email" yazan butonları kontrol et
                    const emailButtons = Array.from(document.querySelectorAll('button')).filter(button => 
                        button.textContent.toLowerCase().includes('e-posta') || 
                        button.textContent.toLowerCase().includes('email')
                    );
                    if (!email && emailButtons.length > 0) {
                        const emailText = emailButtons[0].textContent;
                        const emailMatch = emailText.match(emailRegex);
                        if (emailMatch) {
                            email = emailMatch[0];
                        }
                    }
                    
                    return {
                        isim: isim.trim(),
                        adres: adres.trim(),
                        telefon: telefon.trim(),
                        website: website.trim(),
                        email: email.trim()
                    };
                });
                
                if (firmaDetay.isim && !firmalar.some(f => f.isim === firmaDetay.isim)) {
                    firmalar.push(firmaDetay);
                    console.log(`Firma eklendi (${firmalar.length}): ${firmaDetay.isim} (Tel: ${firmaDetay.telefon || 'Yok'}) (Email: ${firmaDetay.email || 'Yok'})`);
                    
                    // Her 5 firmada bir dosyalara kaydet
                    if (firmalar.length % 5 === 0 && firmalar.length > sonKayitIndex) {
                        await dosyalariGuncelle(firmalar, anahtarKelime, sehir);
                        sonKayitIndex = firmalar.length;
                        console.log(`Ara kayıt yapıldı: ${firmalar.length} firma kaydedildi.`);
                    }
                }
                
                index++;
                
            } catch (error) {
                console.log('Firma işlenirken hata:', error.message);
                index++; // Hataya rağmen devam et
            }
        }
        
        // Son durumu dosyalara kaydet
        if (firmalar.length > 0) {
            await dosyalariGuncelle(firmalar, anahtarKelime, sehir);
            console.log(`İşlem tamamlandı! Toplam ${firmalar.length} firma kaydedildi.`);
        } else {
            throw new Error('Hiç firma bulunamadı. Lütfen arama terimlerinizi kontrol edin.');
        }
        
    } catch (error) {
        console.log('Hata oluştu:', error.message);
        console.log('Lütfen şunları kontrol edin:');
        console.log('1. İnternet bağlantınızın stabil olduğundan emin olun');
        console.log('2. Google Maps\'e erişiminizin olduğundan emin olun');
        console.log('3. Arama terimlerinin doğru olduğundan emin olun');
    } finally {
        await browser.close();
    }
}

async function dosyalariGuncelle(firmalar, anahtarKelime, sehir) {
    const excelDosyasi = 'firma_bilgileri.xlsx';
    
    // Excel dosyasını oku veya yeni bir workbook oluştur
    let workbook;
    let existingData = [];
    let existingFirmalar = new Set(); // Mevcut firma isimlerini tutmak için
    
    if (fs.existsSync(excelDosyasi)) {
        workbook = XLSX.readFile(excelDosyasi);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        // Başlık satırını kaldır
        if (existingData.length > 0) {
            existingData.shift();
        }
        // Mevcut firma isimlerini Set'e ekle
        existingData.forEach(row => {
            if (row[0]) { // Firma ismi varsa
                existingFirmalar.add(row[0].toLowerCase().trim());
            }
        });
    } else {
        workbook = XLSX.utils.book_new();
        existingData = [];
    }
    
    
    const yeniFirmalar = firmalar.filter(firma => 
        !existingFirmalar.has(firma.isim.toLowerCase().trim())
    );
    
    if (yeniFirmalar.length === 0) {
        console.log('Yeni firma bulunamadı, Excel dosyası güncellenmedi.');
        return;
    }
  
    const yeniVeriler = yeniFirmalar.map(firma => [
        firma.isim,
        sehir,
        'Genel',
        firma.telefon ? firma.telefon.replace('Telefon: ', '') : 'Bulunamadı',
        firma.email || 'Bulunamadı',
        firma.website || 'Bulunamadı',
        anahtarKelime
    ]);
    
   
    const tumVeriler = [
        ['Firma İsmi', 'Şehir', 'Lokasyon', 'Telefon', 'Email', 'Website', 'Sektör'],
        ...existingData,
        ...yeniVeriler
    ];
    
   
    const worksheet = XLSX.utils.aoa_to_sheet(tumVeriler);
    
    
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Firma Bilgileri');
    
   
    XLSX.writeFile(workbook, excelDosyasi);
    console.log(`${yeniFirmalar.length} yeni firma eklendi. Toplam firma sayısı: ${tumVeriler.length - 1}`);
}


async function tumAramalariYap() {
    //şehir dizisi
    const sehirler = [
        "Hatay",
        "hatay kırıkhan ",
        "hatay arsuz",
        "hatay erzin",
        "hatay akbez"
        
    ];
    //sektör dizisi
    const sektorler = [
        "Emlak Ofisi",
        "Elektrikçi",
        "Mutfak",
        "Su Tesisatçısı",
        "Marangoz",
        "Oto Tamirci",
        "Klima Servisi",
        "Cep Telefonu Tamiri"
        
    ];

    for (const sehir of sehirler) {
        for (const sektor of sektorler) {
            console.log(`\n${sehir} şehrinde ${sektor} araması başlıyor...`);
            try {
                await scrapeGoogleMaps(sehir, sektor);
               
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                console.error(`${sehir} - ${sektor} aramasında hata:`, error);
                continue; 
            }
        }
    }
    
    console.log("Tüm aramalar tamamlandı!");
}


tumAramalariYap().catch(console.error);
