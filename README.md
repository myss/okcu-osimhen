# Osimhen: Belgrad Ormanı · Osimhen: Belgrad Forest

**Türkçe** · [English](#english)

Bu oyun bir akrabamla oğlumun oyunu. Ben yalnızca ufak tefek yardım ettim.

Oyunu "vibe coding" ile yaptık: Ne istediklerini çoğu zaman Claude Code'a kendileri söyledi, kodu da Claude Opus 5.5 yazdı. Kahramanın Belgrad Ormanı'nda kaybolan Osimhen olmasına, King Kong'un insan boyunun tam üç katı olmasına ve ona ancak bir ağaçta asılı duran RPG-7 ile gücün yetmesine onlar karar verdi. Ejderha yerine T-Rex'i, rakip futbolculara da domates atılmasını onlar istedi. Boss dövüşlerinde gelen maymunların yavaş koşup biraz kovaladıktan sonra sıkılıp gitmesi de onların fikri. Her yeni hâlini oynayıp bozuk yerleri de çoğu zaman onlar yakaladı. Mesela stadyumdaki alkış sesinin cızırtı gibi çıktığını, ejderha dövüşündeki kaplanların zıplasan bile Osimhen'i yakaladığını onlar fark etti.

## Hikâye

Galatasaraylı Osimhen Belgrad Ormanı'nda kaybolmuş. Yanında bir ok torbası, bir AK-47 ve bir Smith & Wesson tabancası var. Ormanın son kapısına ulaşıp kurtulmak için önüne çıkan hayvanları ve canavarları geçmesi gerekiyor. Kapıdan çıkınca da RAMS Park'a giriyor, bütün stat onu alkışlıyor.

## Bölümler

Bölümler orman yolu boyunca sırayla geliyor. Bir bölümün düşmanları bitmeden yolu kapatan devrik kütükler kalkmıyor.

- **Maymunlar:** Vahşi maymunlar ağaçlardan atlayıp saldırıyor.
- **Kurtlar:** Uzaktan Osimhen'in üstüne atılıyorlar.
- **King Kong:** Ormanın ortasındaki açıklıkta, insan boyunun üç katı. Yere vurup kaya fırlatıyor. Oklar ona işlemiyor; açıklıktaki büyük ağaçlardan birinin dalında asılı duran RPG-7'yi bulmak gerekiyor.
- **Aslanlar ve kaplanlar:** King Kong'un ardındaki yolda.
- **T-Rex:** Yakına gelince ısırıyor, uzaktan da koşarak çarpıyor.
- **Fenerbahçe ve Beşiktaş futbolcuları:** Kayarak müdahale ediyorlar. Bu maçta silah yok, sadece domates var; domatesi yiyen sahadan kaçıyor.
- **İki ejderha:** Biri sarı-lacivert, biri siyah-beyaz. Havada dönüp ateş topu atıyor, yere inince ateş püskürtüyorlar.
- **RAMS Park:** Ormandan çıkınca sarı-kırmızı tribünler, havai fişekler ve "Cimbom" şarkısı.

Ölünce oyun en son ulaşılan bölümden devam ediyor.

## Nasıl oynanır?

`index.html` dosyasına çift tıklamanız yeterli, bir şey kurmanıza gerek yok. Oyun kaldığınız yeri tarayıcıya kaydediyor.

| Tuş | Ne işe yarar? |
| --- | --- |
| W A S D | Koşar |
| Q | Hızlı koşmayı açar, kapatır |
| Shift | Basılı tutunca hızlı koşar |
| Boşluk | Zıplar |
| Fare | Nişan alır |
| Sol tık / F | Ateş eder; basılı tutunca seri atar |
| E | RPG-7'yi ve roketleri alır |
| Tab / tekerlek | Mermisi olan bir sonraki silaha geçer |
| 1 2 3 4 | Yay, AK-47, Smith & Wesson, RPG-7 |
| P / Esc | Oyunu durdurur |
| Home | Ekran düğmelerini açar, kapatır |

Fare olmayan cihazlarda ekran düğmeleri kendiliğinden çıkıyor. Farenin de olduğu cihazlarda ise ekrana ilk dokunuşta açılıyor. Nişan almak için parmağınızı ekranda kaydırıyorsunuz.

## Kod

Düz JavaScript ve [Three.js](https://threejs.org) kullanıldı, derlemeye gerek yok. Ses dosyası da yok; bütün sesleri ve müziği kod üretiyor.

- `js/game.js`: Oyunun kuralları, orman, bölümler, düşmanlar, bosslar, silahlar, kontroller ve ekran.
- `js/models.js`: Osimhen, hayvanlar, futbolcular, King Kong, T-Rex, ejderhalar ve silahlar.
- `js/stadium.js`: Sondaki RAMS Park sahnesi.
- `js/sound.js`: Ses efektleri ve müzik çalar.
- `js/cimbom.js`: Stadyumda çalan "Cimbom" şarkısının notaları, Kaplan Macerası'ndan.
- `js/touch.js`: Fare olmadan oynamak için ekran düğmeleri.
- `style.css`: Ekran yazıları, menüler ve ekran düğmelerinin yerleri.
- `vendor/three.min.js`: Three.js r149 (0.149.0). npm paketindeki hazır `build/three.min.js` dosyası; düz `<script>` ile yüklendiği için çift tıklayınca çalışıyor.

---

<a id="english"></a>

# English

[Türkçe](#osimhen-belgrad-ormanı--osimhen-belgrad-forest) · **English**

This is a game by a relative of mine and my son. I only helped out a little.

We vibe-coded it: most of the time they told Claude Code what they wanted themselves, and Claude Opus 5.5 wrote the code. They decided that the hero is Osimhen, lost in Belgrad Forest, that King Kong is exactly three times a person's height, and that only an RPG-7 hanging from a tree can beat him. They wanted a T-Rex instead of a dragon, and tomatoes to throw at the rival footballers. The monkeys in the boss fights running slowly and getting bored after a short chase was their idea too. They played each new version and often caught what was broken, like the stadium applause sounding like static, or the tigers in the dragon fight catching Osimhen even when he jumped.

## The story

Galatasaray's Osimhen is lost in Belgrad Forest, with a quiver of arrows, an AK-47 and a Smith & Wesson revolver. To get out through the forest's last gate he has to get past the animals and monsters in his way. Through the gate he walks into RAMS Park, where the whole stadium cheers for him.

## The levels

The levels come one after another along the forest path. Fallen logs block the path until a level's enemies are all beaten. The in-game text is Turkish:

- **Monkeys:** wild monkeys jump down from the trees
- **Wolves:** they lunge at Osimhen from a distance
- **King Kong:** in a clearing in the middle of the forest, three times a person's height; he slams the ground and throws rocks, arrows don't hurt him, and you need the RPG-7 hanging from one of the clearing's big trees
- **Lions and tigers:** on the path beyond King Kong
- **T-Rex:** bites up close and charges from afar
- **Fenerbahçe and Beşiktaş footballers:** they slide-tackle; this match has no guns, only tomatoes, and a player hit by one runs off the pitch
- **Two dragons:** one yellow and navy, one black and white; they circle overhead throwing fireballs and land to breathe fire
- **RAMS Park:** out of the forest, red and yellow stands, fireworks and the song "Cimbom"

After dying, the game carries on from the last level reached.

## Playing

Double-click `index.html`. There is nothing to install. The game's text is in Turkish. It saves where you are in the browser.

| Key | What it does |
| --- | --- |
| W A S D | Run |
| Q | Fast running on or off |
| Shift | Run fast while held |
| Space | Jump |
| Mouse | Aim |
| Click / F | Fire; hold to keep firing |
| E | Take the RPG-7 or rockets |
| Tab / wheel | Next weapon that has ammo |
| 1 2 3 4 | Bow, AK-47, Smith & Wesson, RPG-7 |
| P / Esc | Pause |
| Home | Show or hide the on-screen buttons |

On-screen buttons appear by themselves on devices without a mouse. On devices that also have a mouse, they appear at the first touch. Slide a finger across the screen to aim.

## The code

Plain JavaScript and [Three.js](https://threejs.org), with no build step. Sounds and music are generated by code rather than loaded from files. The list of files is in the [Turkish section](#kod).
