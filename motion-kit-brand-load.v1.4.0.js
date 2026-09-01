(function (global) {
  "use strict";

  const STYLE_ID = "motion-kit-brand-load-v1-4-styles";
  const initialized = new WeakMap();

  function addStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mk-brand-root] {
        perspective: var(--mk-brand-perspective, 500px);
      }

      [data-mk-brand-letter] {
        display: inline-grid;
        transform-origin: 50% 50%;
        transform-style: preserve-3d;
        will-change: transform;
      }

      [data-mk-brand-face] {
        grid-area: 1 / 1;
        display: block;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }

      [data-mk-brand-face="front"] {
        transform: rotateY(0deg) translateZ(0.01em);
      }

      [data-mk-brand-face="back"] {
        transform: rotateY(180deg) translateZ(0.01em);
      }
    `;
    doc.head.appendChild(style);
  }

  function resolveTargets(targets, root) {
    if (typeof targets === "string") {
      return Array.from(root.querySelectorAll(targets));
    }

    if (targets instanceof Element) return [targets];
    return Array.from(targets || []);
  }

  function makeTwoFacedLetter(doc, character) {
    const wrapper = doc.createElement("span");
    const front = doc.createElement("span");
    const back = doc.createElement("span");

    wrapper.setAttribute("data-mk-brand-letter", character);
    front.setAttribute("data-mk-brand-face", "front");
    back.setAttribute("data-mk-brand-face", "back");
    back.setAttribute("aria-hidden", "true");

    front.textContent = character;
    back.textContent = character;
    wrapper.append(front, back);

    return wrapper;
  }

  function wrapSelectedLetters(element, selectedLetters) {
    const doc = element.ownerDocument;
    const walker = doc.createTreeWalker(
      element,
      doc.defaultView.NodeFilter.SHOW_TEXT
    );
    const textNodes = [];
    const wrappedLetters = [];
    let node;

    while ((node = walker.nextNode())) {
      if (node.nodeValue) textNodes.push(node);
    }

    textNodes.forEach(function (textNode) {
      const fragment = doc.createDocumentFragment();
      let changed = false;

      Array.from(textNode.nodeValue).forEach(function (character) {
        if (selectedLetters.has(character)) {
          const letter = makeTwoFacedLetter(doc, character);
          fragment.appendChild(letter);
          wrappedLetters.push(letter);
          changed = true;
        } else {
          fragment.appendChild(doc.createTextNode(character));
        }
      });

      if (changed) textNode.replaceWith(fragment);
    });

    return wrappedLetters;
  }

  function brandLoad(targets, options) {
    if (!global.gsap) {
      throw new Error(
        "MotionKit.brandLoad requires GSAP. Enable Webflow's GSAP integration before loading this file."
      );
    }

    const settings = Object.assign(
      {
        root: document,
        letters: "BTA",
        duration: 1.6,
        stagger: 0.16,
        delay: 0.15,
        rotationY: -360,
        perspective: 500,
        ease: "power2.inOut",
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
    const elements = resolveTargets(targets, root);
    const selectedLetters = new Set(Array.from(settings.letters));
    const created = [];

    addStyles(doc);

    elements.forEach(function (element) {
      if (initialized.has(element)) return;

      const originalHTML = element.innerHTML;
      const letters = wrapSelectedLetters(element, selectedLetters);
      if (!letters.length) return;

      element.setAttribute("data-mk-brand-root", "");
      element.style.setProperty(
        "--mk-brand-perspective",
        settings.perspective + "px"
      );

      const timeline = global.gsap.timeline({ delay: settings.delay });

      timeline.fromTo(
        letters,
        { rotationY: settings.rotationY },
        {
          rotationY: 0,
          duration: settings.duration,
          ease: settings.ease,
          stagger: settings.stagger,
          clearProps: "transform"
        }
      );

      function destroy() {
        timeline.kill();
        element.innerHTML = originalHTML;
        element.removeAttribute("data-mk-brand-root");
        element.style.removeProperty("--mk-brand-perspective");
        initialized.delete(element);
      }

      const instance = {
        element: element,
        letters: letters,
        timeline: timeline,
        destroy: destroy
      };

      initialized.set(element, instance);
      created.push(instance);
    });

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
  global.MotionKit.brandLoad = brandLoad;
  global.MotionKit.brandLoadVersion = "1.4.0";
})(window);
