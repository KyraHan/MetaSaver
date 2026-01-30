# Metasaver

Metasaver, **metadata saklamayan veya toplamayan**, minimal ve hızlı bir React Native projesidir.  
Temel amaç; uygulamanın hafif, gizlilik odaklı ve bakımı kolay olmasını sağlamaktır.

## Neden metadata yok?
Bu proje bilinçli olarak:
- Kullanıcı metadata’sı saklamaz veya kaydetmez
- Kullanıcı davranışlarını, cihaz bilgilerini veya konum verilerini izlemez
- Karmaşıklığı azaltmayı ve performansı artırmayı hedefler
- Varsayılan olarak gizlilik odaklı bir yaklaşım benimser

Metadata, teknik bir kısıtlama nedeniyle değil, **bilinçli bir tasarım kararı** olarak hariç tutulmuştur.

## Özellikler
- ✅ Hafif ve minimal mimari
- ✅ Metadata saklanmaz veya kaydedilmez
- ✅ Temiz, sürdürülebilir kod yapısı
- ✅ Hızlı çalışma ve düşük bellek kullanımı
- 🚫 Analitik veya harici izleme servisleri yoktur (bilinçli tercih)

## Teknik Özellikler
- **Framework (Uygulama Çalıştırma Çerçevesi):** React Native 0.83.1

## Kurulum
```bash
git clone https://github.com/kyrahan/metasaver.git
cd metasaver
yarn install
yarn start
yarn android   # veya yarn ios
