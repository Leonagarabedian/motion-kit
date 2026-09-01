(function (global) {
  "use strict";

  const STYLE_ID = "motion-kit-tags-glitch-v1-styles";
  const initialized = new WeakMap();
  let sequence = 0;

  function addStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mk-tags-glitch-section] {
        position: relative !important;
        min-height: var(--mk-tags-glitch-height, 180vh) !important;
        padding: 0 !important;
        overflow: clip !important;
        isolation: isolate;
      }

      [data-mk-tags-glitch-stage] {
        position: sticky;
        top: 0;
        width: 100%;
        height: 100vh;
        height: 100svh;
        overflow: clip;
      }

      [data-mk-tags-glitch-field] {
        position: absolute !important;
        inset: 0 !important;
        z-index: 1;
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
      }

      [data-mk-tags-glitch-chip] {
        position: absolute !important;
        left: var(--mk-chip-x) !important;
        top: var(--mk-chip-y) !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        font-size: clamp(0.72rem, 1.1vw, 1.125rem);
        line-height: 1;
        white-space: nowrap;
        transform: translate(-50%, -50%);
        transform-origin: 50% 50%;
      }

      [data-mk-tags-glitch-title] {
        position: absolute !important;
        z-index: 2;
        top: 50% !important;
        left: 50% !important;
        width: min(48rem, calc(100% - 2rem)) !important;
        margin: 0 !important;
        text-align: center;
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      [data-mk-tags-glitch-char] {
        display: inline-block;
        will-change: transform, opacity;
      }

      @media (max-width: 767px) {
        [data-mk-tags-glitch-section] {
          min-height: var(--mk-tags-glitch-height-mobile, 165vh) !important;
        }

        [data-mk-tags-glitch-chip] {
          font-size: 0.7rem;
        }
      }
    `;
    doc.head.appendChild(style);
  }

  function resolveElements(value, root) {
    if (typeof value === "string") return Array.from(root.querySelectorAll(value));
    if (value instanceof Element) return [value];
    return Array.from(value || []);
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function between(random, min, max) {
    return min + (max - min) * random();
  }

  function shuffle(random, items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      const item = items[index];
      items[index] = items[swapIndex];
      items[swapIndex] = item;
    }
    return items;
  }

  function splitCharacters(element) {
    const originalHtml = element.innerHTML;
    const originalLabel = element.getAttribute("aria-label");
    const label = element.textContent.trim();
    const fragment = element.ownerDocument.createDocumentFragment();
    const characters = [];

    Array.from(label).forEach(function (character) {
      const span = element.ownerDocument.createElement("span");
      span.setAttribute("data-mk-tags-glitch-char", "");
      span.setAttribute("aria-hidden", "true");
      span.textContent = character === " " ? "\u00a0" : character;
      fragment.appendChild(span);
      characters.push(span);
    });

    element.replaceChildren(fragment);
    element.setAttribute("aria-label", label);

    return {
      characters: characters,
      restore: function () {
        element.innerHTML = originalHtml;
        if (originalLabel === null) element.removeAttribute("aria-label");
        else element.setAttribute("aria-label", originalLabel);
      }
    };
  }

  function layoutChips(chips, seed) {
    const mobile = global.innerWidth <= 767;
    const columns = mobile ? 3 : 5;
    const rows = Math.ceil(chips.length / columns);
    const random = seededRandom(seed + (mobile ? 91 : 0));
    const cells = shuffle(
      random,
      Array.from({ length: columns * rows }, function (_, index) {
        return index;
      })
    );

    chips.forEach(function (chip, index) {
      const cell = cells[index];
      const column = cell % columns;
      const row = Math.floor(cell / columns);
      const x = ((column + 0.5) / columns) * 100 + between(random, -4, 4);
      const y = ((row + 0.5) / rows) * 100 + between(random, -3, 3);

      chip.style.setProperty("--mk-chip-x", x.toFixed(3) + "%");
      chip.style.setProperty("--mk-chip-y", y.toFixed(3) + "%");
    });
  }

  function tagsGlitch(sectionTargets, options) {
    if (!global.gsap || !global.ScrollTrigger) {
      throw new Error(
        "MotionKit.tagsGlitch requires GSAP and ScrollTrigger. Enable both in Webflow's GSAP integration."
      );
    }

    global.gsap.registerPlugin(global.ScrollTrigger);

    const settings = Object.assign(
      {
        root: document,
        chipSelector: ".ns-chip",
        fieldSelector: ".ns-chip-row",
        titleSelector: ".ns-tags-title",
        sectionHeight: "180vh",
        mobileSectionHeight: "165vh",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        seed: 2604,
        scatterX: 12,
        scatterYMin: 55,
        scatterYMax: 160,
        rotation: 20,
        chipFadeEnd: 0.68,
        titleStart: 0.18,
        titleEnd: 0.72,
        markers: false,
        respectReducedMotion: true
      },
      options || {}
    );

    if (
      settings.respectReducedMotion &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return { count: 0, destroy: function () {} };
    }

    const root = settings.root || document;
    const doc = root.ownerDocument || document;
    const sections = resolveElements(sectionTargets, root);
    const created = [];

    addStyles(doc);

    sections.forEach(function (section, sectionIndex) {
      if (initialized.has(section)) return;

      const field = section.querySelector(settings.fieldSelector);
      const title = section.querySelector(settings.titleSelector);
      const chips = field
        ? Array.from(field.querySelectorAll(settings.chipSelector))
        : [];

      if (!field || !title || !chips.length) return;

      const stage = doc.createElement("div");
      stage.setAttribute("data-mk-tags-glitch-stage", "");
      section.insertBefore(stage, title);
      stage.append(title, field);

      section.setAttribute("data-mk-tags-glitch-section", "");
      field.setAttribute("data-mk-tags-glitch-field", "");
      title.setAttribute("data-mk-tags-glitch-title", "");
      chips.forEach(function (chip) {
        chip.setAttribute("data-mk-tags-glitch-chip", "");
      });

      section.style.setProperty("--mk-tags-glitch-height", settings.sectionHeight);
      section.style.setProperty(
        "--mk-tags-glitch-height-mobile",
        settings.mobileSectionHeight
      );

      const sectionSeed = Number(settings.seed) + sectionIndex * 1009;
      layoutChips(chips, sectionSeed);

      const chipSplits = chips.map(splitCharacters);
      const titleSplit = splitCharacters(title);
      const chipCharacters = chipSplits.flatMap(function (split) {
        return split.characters;
      });

      const random = seededRandom(sectionSeed + 17);
      const destinations = chipCharacters.map(function () {
        return {
          x: between(random, -Number(settings.scatterX), Number(settings.scatterX)),
          y: between(
            random,
            Number(settings.scatterYMin),
            Number(settings.scatterYMax)
          ),
          rotation: between(
            random,
            -Number(settings.rotation),
            Number(settings.rotation)
          )
        };
      });

      global.gsap.set(titleSplit.characters, { autoAlpha: 0, y: 12 });
      global.gsap.set(chipCharacters, { x: 0, y: 0, rotation: 0, autoAlpha: 1 });

      const timeline = global.gsap.timeline({
        scrollTrigger: {
          id: "mk-tags-glitch-" + ++sequence,
          trigger: section,
          start: settings.start,
          end: settings.end,
          scrub: settings.scrub,
          invalidateOnRefresh: true,
          markers: settings.markers
        }
      });

      timeline.to(
        chipCharacters,
        {
          x: function (index) {
            return destinations[index].x;
          },
          y: function (index) {
            return destinations[index].y;
          },
          rotation: function (index) {
            return destinations[index].rotation;
          },
          autoAlpha: 0,
          duration: Number(settings.chipFadeEnd),
          ease: "none",
          stagger: {
            each:
              Number(settings.chipFadeEnd) /
              Math.max(1, chipCharacters.length * 3.5),
            from: "random"
          }
        },
        0
      );

      timeline.to(
        titleSplit.characters,
        {
          autoAlpha: 1,
          y: 0,
          duration: Math.max(
            0.01,
            Number(settings.titleEnd) - Number(settings.titleStart)
          ),
          ease: "none",
          stagger: {
            each:
              Math.max(
                0.01,
                Number(settings.titleEnd) - Number(settings.titleStart)
              ) /
              Math.max(1, titleSplit.characters.length * 2.4),
            from: "start"
          }
        },
        Number(settings.titleStart)
      );

      let resizeTimer = 0;
      function onResize() {
        global.clearTimeout(resizeTimer);
        resizeTimer = global.setTimeout(function () {
          layoutChips(chips, sectionSeed);
          global.ScrollTrigger.refresh();
        }, 150);
      }
      global.addEventListener("resize", onResize);

      function destroy() {
        global.removeEventListener("resize", onResize);
        global.clearTimeout(resizeTimer);
        if (timeline.scrollTrigger) timeline.scrollTrigger.kill();
        timeline.kill();

        global.gsap.set(chipCharacters.concat(titleSplit.characters), {
          clearProps: "transform,opacity,visibility"
        });
        chipSplits.forEach(function (split) {
          split.restore();
        });
        titleSplit.restore();

        chips.forEach(function (chip) {
          chip.removeAttribute("data-mk-tags-glitch-chip");
          chip.style.removeProperty("--mk-chip-x");
          chip.style.removeProperty("--mk-chip-y");
        });
        field.removeAttribute("data-mk-tags-glitch-field");
        title.removeAttribute("data-mk-tags-glitch-title");
        section.removeAttribute("data-mk-tags-glitch-section");
        section.style.removeProperty("--mk-tags-glitch-height");
        section.style.removeProperty("--mk-tags-glitch-height-mobile");

        section.insertBefore(title, stage);
        section.insertBefore(field, stage);
        stage.remove();
        initialized.delete(section);
      }

      const instance = {
        section: section,
        stage: stage,
        field: field,
        title: title,
        chips: chips,
        timeline: timeline,
        destroy: destroy
      };

      initialized.set(section, instance);
      created.push(instance);
    });

    global.ScrollTrigger.refresh();

    return {
      count: created.length,
      instances: created,
      destroy: function () {
        created.forEach(function (instance) {
          instance.destroy();
        });
      }
    };
  }

  global.MotionKit = global.MotionKit || {};
  global.MotionKit.tagsGlitch = tagsGlitch;
  global.MotionKit.tagsGlitchVersion = "1.0.0";
})(window);
