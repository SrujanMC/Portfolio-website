from pathlib import Path

path = Path(r'd:\Interpreter\sylva\index.html')
text = path.read_text(encoding='utf-8')
start = text.index('<section class="koi-stack-section" aria-labelledby="koi-stack-heading">')
end = text.index('<section class="sketchbook" aria-labelledby="sketchbook-heading" tabindex="0">')
replacement = '''<section class="koi-stack-section" aria-labelledby="koi-stack-heading">
        <style>
          .koi-stack-section {
            position: relative;
            padding: 4.25rem 1.25rem 5.5rem;
            background: linear-gradient(180deg, rgba(240, 235, 226, 0.9), rgba(234, 225, 211, 0.94));
            border-top: 1px solid rgba(46, 39, 32, 0.08);
            overflow: hidden;
          }
          .koi-stack-header {
            width: min(1200px, calc(100vw - 2rem));
            margin: 0 auto 2.25rem;
            text-align: center;
          }
          .koi-stack-header .eyebrow {
            margin-bottom: 0.8rem;
            color: rgba(57, 51, 41, 0.64);
            font-size: 0.72rem;
            letter-spacing: 0.24em;
            text-transform: uppercase;
          }
          .koi-stack-header h2 {
            font-size: clamp(2.2rem, 4vw, 4.25rem);
            line-height: 0.94;
            letter-spacing: -0.07em;
            font-weight: 400;
            color: #2f2a22;
          }
          .koi-stack-header p:last-child {
            max-width: 680px;
            margin: 0.9rem auto 0;
            font-size: 1.05rem;
            line-height: 1.7;
            color: rgba(47, 42, 34, 0.72);
          }
          .koi-stack-stage {
            position: relative;
            width: min(100%, 980px);
            min-height: 620px;
            margin: 0 auto;
            display: grid;
            place-items: center;
          }
          .koi-card-stack {
            position: relative;
            width: min(80vw, 390px);
            aspect-ratio: 0.75;
            perspective: 1200px;
          }
          .koi-card {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: clamp(1.2rem, 2vw, 1.7rem);
            border-radius: 28px;
            border: 1px solid rgba(43, 33, 25, 0.12);
            background: linear-gradient(180deg, rgba(41, 40, 34, 0.96), rgba(23, 20, 17, 0.98));
            box-shadow: 0 18px 52px rgba(21, 18, 15, 0.22);
            overflow: hidden;
            transform-origin: center center;
            transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease, filter 0.45s ease;
            will-change: transform, opacity;
          }
          .koi-card::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 20% 16%, rgba(255,255,255,0.17), transparent 40%),
              linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 35%, rgba(0,0,0,0.08));
            pointer-events: none;
          }
          .koi-card[data-tone="warm"] { background: linear-gradient(180deg, #251f1b, #181411); }
          .koi-card[data-tone="sage"] { background: linear-gradient(180deg, #1d261f, #111915); }
          .koi-card[data-tone="amber"] { background: linear-gradient(180deg, #2a1f1a, #17110f); }
          .koi-card.active {
            z-index: 3;
            opacity: 1;
            filter: none;
            transform: translate3d(0, 0, 12px) rotateY(0deg) rotateX(0deg) scale(1);
          }
          .koi-card.next {
            z-index: 2;
            opacity: 0.72;
            filter: saturate(0.92);
            transform: translate3d(26px, 18px, -10px) rotateY(-10deg) rotateX(6deg) scale(0.96);
          }
          .koi-card.prev {
            z-index: 1;
            opacity: 0.62;
            filter: saturate(0.8);
            transform: translate3d(-26px, 18px, -22px) rotateY(10deg) rotateX(6deg) scale(0.94);
          }
          .koi-card.hidden {
            opacity: 0;
            pointer-events: none;
            transform: translate3d(0, 38px, -30px) scale(0.9);
          }
          .koi-card-visual {
            position: relative;
            height: 66%;
            border-radius: 20px;
            overflow: hidden;
            margin-bottom: 1.2rem;
            border: 1px solid rgba(255,255,255,0.06);
          }
          .koi-card-visual img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            filter: saturate(0.96) contrast(1.02);
          }
          .koi-card-copy {
            position: relative;
            z-index: 1;
            color: #eee4d4;
          }
          .koi-card-copy strong {
            display: block;
            font-size: 0.82rem;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: rgba(238, 228, 212, 0.72);
            font-weight: 500;
            margin-bottom: 0.6rem;
          }
          .koi-card-copy h3 {
            font-size: clamp(2rem, 5vw, 3.2rem);
            line-height: 0.88;
            letter-spacing: -0.07em;
            font-weight: 400;
            margin-bottom: 0.55rem;
          }
          .koi-card-copy p {
            max-width: 16ch;
            font-size: 0.9rem;
            line-height: 1.55;
            color: rgba(238, 228, 212, 0.76);
          }
          .koi-stack-controls {
            display: flex;
            justify-content: center;
            gap: 0.85rem;
            margin-top: 1.6rem;
          }
          .koi-stack-button {
            appearance: none;
            border: 0;
            border-radius: 999px;
            background: rgba(64, 58, 48, 0.82);
            color: #f6efe4;
            padding: 0.8rem 1.1rem;
            font-size: 0.78rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            cursor: pointer;
            transition: transform 0.2s ease, background 0.2s ease;
          }
          .koi-stack-button:hover,
          .koi-stack-button:focus-visible {
            background: rgba(84, 72, 58, 0.94);
            transform: translateY(-1px);
          }
          @media (max-width: 640px) {
            .koi-card-stack {
              width: min(82vw, 330px);
            }
            .koi-stack-header p:last-child {
              font-size: 0.96rem;
            }
          }
        </style>

        <div class="koi-stack-header">
          <p class="eyebrow">Field notes · Sylva</p>
          <h2 id="koi-stack-heading">A living world, page by page.</h2>
          <p>Turn through the quiet details of a woodland returning to life.</p>
        </div>

        <div class="koi-stack-stage" aria-live="polite">
          <div class="koi-card-stack" aria-label="Interactive forest field guide">
            <article class="koi-card active" data-tone="warm" aria-label="Kōhaku">
              <div class="koi-card-visual">
                <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80" alt="Deep forest river at dusk" loading="lazy" />
              </div>
              <div class="koi-card-copy">
                <strong>Kōhaku</strong>
                <h3>Move like water.</h3>
                <p>Keep the light quiet, and let every movement carry intention.</p>
              </div>
            </article>

            <article class="koi-card next" data-tone="sage" aria-label="Shūsui">
              <div class="koi-card-visual">
                <img src="https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=900&q=80" alt="Mossy woodland floor and treeline" loading="lazy" />
              </div>
              <div class="koi-card-copy">
                <strong>Shūsui</strong>
                <h3>Two currents.</h3>
                <p>Two lives meeting in a still place, without noise or friction.</p>
              </div>
            </article>

            <article class="koi-card prev hidden" data-tone="amber" aria-label="Utsuri">
              <div class="koi-card-visual">
                <img src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80" alt="Sunlight moving across a forest" loading="lazy" />
              </div>
              <div class="koi-card-copy">
                <strong>Utsuri</strong>
                <h3>Stillness carries.</h3>
                <p>Let the woodland settle, and the details begin to speak.</p>
              </div>
            </article>
          </div>
        </div>

        <div class="koi-stack-controls" aria-label="Card stack controls">
          <button class="koi-stack-button" type="button" data-direction="prev">Previous</button>
          <button class="koi-stack-button" type="button" data-direction="next">Next</button>
        </div>

        <script>
          (() => {
            const cards = [...document.querySelectorAll('.koi-card')];
            const buttons = [...document.querySelectorAll('.koi-stack-button')];
            let activeIndex = 0;

            function updateStack() {
              cards.forEach((card, index) => {
                card.classList.remove('active', 'next', 'prev', 'hidden');
                const offset = (index - activeIndex + cards.length) % cards.length;

                if (offset === 0) {
                  card.classList.add('active');
                } else if (offset === 1) {
                  card.classList.add('next');
                } else if (offset === cards.length - 1) {
                  card.classList.add('prev');
                } else {
                  card.classList.add('hidden');
                }
              });
            }

            function move(direction) {
              if (direction === 'next') {
                activeIndex = (activeIndex + 1) % cards.length;
              } else {
                activeIndex = (activeIndex - 1 + cards.length) % cards.length;
              }
              updateStack();
            }

            buttons.forEach((button) => {
              button.addEventListener('click', () => move(button.dataset.direction));
            });

            cards.forEach((card) => {
              card.addEventListener('click', () => move('next'));
            });

            updateStack();
          })();
        </script>
      </section>
'''

text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')
print('Replaced custom koi block.')
