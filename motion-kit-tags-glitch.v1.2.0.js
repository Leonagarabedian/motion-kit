(function (global) {
  "use strict";

  const STYLE_ID = "motion-kit-tags-glitch-v1-2-styles";
  const initialized = new WeakMap();
  let sequence = 0;

  function addStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mk-tags-glitch-section] {
        position: relative !important;
        min-height: var(--mk-tags-glitch-height, 200vh) !important;
        padding: 0 !important;
        overflow: clip !important;
        isolation: isolate;
        background: var(--mk-tags-glitch-background, #0a0a0a) !important;
        color: var(--mk-tags-glitch-color, #ffffff) !important;
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
        min-height: 0 !important;
        margin: 0 !important;
      }

      [data-mk-tags-glitch-cluster] {
        position: absolute !important;
        left: var(--mk-cluster-x) !important;
        top: var(--mk-cluster-y) !important;
        display: block !important;
        width: min(15rem, 28vw) !important;
        max-width: none !important;
        line-height: 1.05;
        transform: translate(-50%, -50%);
      }

      [data-mk-tags-glitch-chip] {
        position: static !important;
        display: inline !important;
        margin: 0 0.42em 0 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: inherit !important;
        font-size: clamp(0.72rem, 1.1vw, 1.125rem) !important;
        line-height: 1 !important;
        white-space: normal !important;
      }

      [data-mk-tags-glitch-title] {
        position: absolute !important;
        z-index: 2;
        top: 50% !important;
        left: 50% !important;
        width: min(13rem, calc(100% - 2rem)) !important;
        max-width: none !important;
        margin: 0 !important;
        color: inherit !important;
        font-size: clamp(0.9rem, 1.1vw, 1.125rem) !important;
        line-height: 1.05 !important;
        text-align: left !important;
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      [data-mk-tags-glitch-char] {
        display: inline-block;
        will-change: transform, opacity;
      }

      @media (max-width: 767px) {
        [data-mk-tags-glitch-section] {
          min-height: var(--mk-tags-glitch-height-mobile, 175vh) !important;
        }

        [data-mk-tags-glitch-cluster] {
          width: min(11rem, 42vw) !important;
        }

        [data-mk-tags-glitch-chip] {
          font-size: 0.7rem !important;
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

  function layoutClusters(clusters, seed) {
    const mobile = global.innerWidth <= 767;
    const random = seededRandom(seed + (mobile ? 91 : 0));
    const positions = mobile
      ? [[25, 15], [73, 24], [27, 41], [72, 54], [27, 72], [72, 82]]
      : [[17, 23], [50, 16], [82, 27], [22, 70], [52, 61], [81, 76]];

    clusters.forEach(function (cluster, index) {
      const base = positions[index % positions.length];
      cluster.style.setProperty(
        "--mk-cluster-x",
        (base[0] + between(random, -2.2, 2.2)).toFixed(3) + "%"
      );
      cluster.style.setProperty(
        "--mk-cluster-y",
        (base[1] + between(random, -1.8, 1.8)).toFixed(3) + "%"
      );
    });
  }

  function createFallbackClusters(field, chips, count, doc) {
    const clusters = Array.from({ length: count }, function () {
      const cluster = doc.createElement("div");
      cluster.setAttribute("data-mk-tags-glitch-generated", "");
      field.appendChild(cluster);
      return cluster;
    });

    chips.forEach(function (chip, index) {
      const clusterIndex = Math.min(
        count - 1,
        Math.floor((index * count) / chips.length)
      );
      clusters[clusterIndex].appendChild(chip);
    });

    return clusters;
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
        clusterSelector: ".ns-tag-cluster",
        titleSelector: ".ns-tags-title",
        sectionHeight: "200vh",
        mobileSectionHeight: "175vh",
        clusterCount: 6,
        backgroundColor: "#0a0a0a",
        textColor: "#ffffff",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.35,
        seed: 2604,
        scatterX: 12,
        scatterYMin: 55,
        scatterYMax: 160,
        rotation: 20,
        chipFadeEnd: 0.68,
        titleStart: 0.2,
        titleEnd: 0.76,
        markers: false,
        respectReducedMotion: true
      },
      options || {}
    );

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

      const originalTitleNextSibling = title.nextSibling;
      const originalFieldNextSibling = field.nextSibling;
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

      let clusters = Array.from(field.querySelectorAll(settings.clusterSelector));
      const usesExistingClusters = clusters.length > 0;

      if (!usesExistingClusters) {
        const clusterCount = Math.max(
          1,
          Math.min(chips.length, Number(settings.clusterCount) || 6)
        );
        clusters = createFallbackClusters(field, chips, clusterCount, doc);
      }

      clusters.forEach(function (cluster) {
        cluster.setAttribute("data-mk-tags-glitch-cluster", "");
      });

      section.style.setProperty("--mk-tags-glitch-height", settings.sectionHeight);
      section.style.setProperty(
        "--mk-tags-glitch-height-mobile",
        settings.mobileSectionHeight
      );
      section.style.setProperty(
        "--mk-tags-glitch-background",
        settings.backgroundColor
      );
      section.style.setProperty("--mk-tags-glitch-color", settings.textColor);

      const sectionSeed = Number(settings.seed) + sectionIndex * 1009;
      layoutClusters(clusters, sectionSeed);

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
      global.gsap.set(chipCharacters, {
        x: 0,
        y: 0,
        rotation: 0,
        autoAlpha: 1
      });

      const timeline = global.gsap.timeline({
        defaults: { ease: "none" },
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
          x: function (index) { return destinations[index].x; },
          y: function (index) { return destinations[index].y; },
          rotation: function (index) { return destinations[index].rotation; },
          autoAlpha: 0,
          duration: Number(settings.chipFadeEnd),
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
          stagger: {
            each:
              Math.max(
                0.01,
                Number(settings.titleEnd) - Number(settings.titleStart)
              ) / Math.max(1, titleSplit.characters.length * 2.4),
            from: "start"
          }
        },
        Number(settings.titleStart)
      );

      const media = global.gsap.matchMedia();
      media.add("(prefers-reduced-motion: reduce)", function () {
        if (!settings.respectReducedMotion) return;
        timeline.scrollTrigger.disable(false, true);
        timeline.progress(1);
      });

      let resizeTimer = 0;
      function onResize() {
        global.clearTimeout(resizeTimer);
        resizeTimer = global.setTimeout(function () {
          layoutClusters(clusters, sectionSeed);
          global.ScrollTrigger.refresh();
        }, 150);
      }
      global.addEventListener("resize", onResize);

      function restoreNode(node, nextSibling) {
        if (nextSibling && nextSibling.parentNode === section) {
          section.insertBefore(node, nextSibling);
        } else {
          section.appendChild(node);
        }
      }

      function destroy() {
        global.removeEventListener("resize", onResize);
        global.clearTimeout(resizeTimer);
        media.revert();
        if (timeline.scrollTrigger) timeline.scrollTrigger.kill();
        timeline.kill();

        global.gsap.set(chipCharacters.concat(titleSplit.characters), {
          clearProps: "transform,opacity,visibility"
        });
        chipSplits.forEach(function (split) { split.restore(); });
        titleSplit.restore();

        chips.forEach(function (chip) {
          chip.removeAttribute("data-mk-tags-glitch-chip");
        });
        clusters.forEach(function (cluster) {
          cluster.removeAttribute("data-mk-tags-glitch-cluster");
          cluster.style.removeProperty("--mk-cluster-x");
          cluster.style.removeProperty("--mk-cluster-y");
        });

        if (!usesExistingClusters) {
          chips.forEach(function (chip) { field.appendChild(chip); });
          clusters.forEach(function (cluster) { cluster.remove(); });
        }

        field.removeAttribute("data-mk-tags-glitch-field");
        title.removeAttribute("data-mk-tags-glitch-title");
        section.removeAttribute("data-mk-tags-glitch-section");
        section.style.removeProperty("--mk-tags-glitch-height");
        section.style.removeProperty("--mk-tags-glitch-height-mobile");
        section.style.removeProperty("--mk-tags-glitch-background");
        section.style.removeProperty("--mk-tags-glitch-color");

        restoreNode(field, originalFieldNextSibling);
        restoreNode(title, originalTitleNextSibling);
        stage.remove();
        initialized.delete(section);
      }

      const instance = {
        section: section,
        stage: stage,
        field: field,
        title: title,
        chips: chips,
        clusters: clusters,
        timeline: timeline,
        destroy: destroy
      };

      initialized.set(section, instance);
      created.push(instance);
    });

    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(function () { global.ScrollTrigger.refresh(); });
    } else {
      global.ScrollTrigger.refresh();
    }

    return {
      count: created.length,
      instances: created,
      destroy: function () {
        created.forEach(function (instance) { instance.destroy(); });
      }
    };
  }

  global.MotionKit = global.MotionKit || {};
  global.MotionKit.tagsGlitch = tagsGlitch;
  global.MotionKit.tagsGlitchVersion = "1.2.0";
})(window);
