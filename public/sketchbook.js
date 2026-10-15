/* Sylva’s interactive field-guide page turn. */
(function () {
  "use strict";

  var section = document.querySelector(".sketchbook");
  if (!section) return;

  var stage = section.querySelector(".sketchbook__book-stage");
  var book = section.querySelector(".sketchbook__book");
  var caption = section.querySelector(".sketchbook__caption");
  var counter = section.querySelector(".sketchbook__counter");
  var previousButton = section.querySelector(
    ".sketchbook__controls .sketchbook__control--previous",
  );
  var nextButton = section.querySelector(".sketchbook__controls .sketchbook__control--next");
  var status = section.querySelector(".sketchbook__status");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pages = [
    {
      title: "A canopy restored",
      place: "Woodland in renewal",
      image:
        "https://ublctyddhtbgaersvxxb.supabase.co/storage/v1/object/public/threeui-media/scene-images/c74a626e396794aa239bca6f/card-ethos.jpg",
      alt: "Moss and lichen growing across a forest floor",
    },
    {
      title: "After the rain",
      place: "A field note in green",
      image:
        "https://ublctyddhtbgaersvxxb.supabase.co/storage/v1/object/public/threeui-media/scene-images/c74a626e396794aa239bca6f/card-ecostove.jpg",
      alt: "Rain-washed stones covered in vivid moss",
    },
    {
      title: "A quieter kind of wild",
      place: "Life beneath the canopy",
      image:
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2560&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Sunlight falling through a quiet green forest",
    },
  ];
  var stripCount = 18;
  var curlSpan = 0.449;
  var curlBend = 0.6;
  var currentPage = 0;
  var turn = null;
  var strips = [];
  var frameId = null;
  var frameTime = 0;
  var spring = null;
  var drag = null;

  function element(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function imageFor(pageIndex, className, alt) {
    var image = element("img", className);
    image.src = pages[pageIndex].image;
    image.alt = alt || "";
    image.draggable = false;
    image.decoding = "async";
    return image;
  }

  function halfPage(side, pageIndex) {
    var half = element("div", "sketchbook__half sketchbook__half--" + side);
    half.appendChild(imageFor(pageIndex, "sketchbook__half-image"));
    var gutter = element("div", "sketchbook__gutter sketchbook__gutter--" + side);
    half.appendChild(gutter);
    return half;
  }

  function createCurl(direction, fromPage, toPage) {
    strips = [];
    var curl = element("div", "sketchbook__curl sketchbook__curl--" + direction);
    curl.style.setProperty("--strip-count", stripCount);
    curl.style.setProperty("--curl-span", curlSpan);
    var parent = curl;
    var pageWidth = "var(--book-width)";
    var stripWidth = "calc(" + pageWidth + " * " + curlSpan + " / " + stripCount + ")";
    var gutterOffset = "calc(" + pageWidth + " * 0.5)";

    for (var index = 0; index < stripCount; index += 1) {
      var strip = element("div", "sketchbook__strip");
      strip.style.setProperty("--strip-index", index);
      var beforeOffset = "calc(-1 * (" + gutterOffset + " + " + index + " * " + stripWidth + "))";
      var afterOffset = "calc(" + (index + 1) + " * " + stripWidth + " - " + gutterOffset + ")";
      var front = element("div", "sketchbook__face sketchbook__face--front");
      var back = element("div", "sketchbook__face sketchbook__face--back");

      function dress(face, pageIndex, offset) {
        face.style.backgroundImage = "url(" + JSON.stringify(pages[pageIndex].image) + ")";
        face.style.backgroundPositionX = offset;
      }

      dress(front, fromPage, direction === "next" ? beforeOffset : afterOffset);
      dress(back, toPage, direction === "next" ? afterOffset : beforeOffset);

      var frontShade = element("div", "sketchbook__face-shade");
      var frontGlint = element("div", "sketchbook__face-glint");
      var backShade = element("div", "sketchbook__face-shade");
      var backGlint = element("div", "sketchbook__face-glint");
      front.appendChild(frontShade);
      front.appendChild(frontGlint);
      back.appendChild(backShade);
      back.appendChild(backGlint);
      strip.appendChild(front);
      strip.appendChild(back);
      parent.appendChild(strip);
      parent = strip;
      strips.push(strip);
    }

    return curl;
  }

  function updateCurl(progress) {
    if (!turn) return;
    var swing = Math.PI * progress;
    var bend = curlBend * Math.sin(Math.PI * progress);
    var degrees = 180 / Math.PI;
    var turnAngle = swing + bend;
    var stripAngle = (2 * bend) / stripCount;
    book.style.setProperty("--book-turn", (turnAngle * degrees).toFixed(2) + "deg");
    book.style.setProperty("--strip-turn", (stripAngle * degrees).toFixed(3) + "deg");
    book.style.setProperty("--book-shade", Math.sin(Math.PI * progress).toFixed(3));

    strips.forEach(function (strip, index) {
      var nearLight = Math.abs(Math.cos(turnAngle - index * stripAngle));
      var farLight = Math.abs(Math.cos(turnAngle - (index + 1) * stripAngle));
      strip.style.setProperty("--strip-light", nearLight.toFixed(3));
      strip.style.setProperty("--shade-a", ((1 - nearLight) * 0.62).toFixed(3));
      strip.style.setProperty("--shade-b", ((1 - farLight) * 0.62).toFixed(3));
    });
  }

  function updateControls() {
    var page = turn ? turn.from : currentPage;
    caption.textContent = pages[page].title + " · " + pages[page].place;
    counter.textContent =
      String(page + 1).padStart(2, "0") + " / " + String(pages.length).padStart(2, "0");
  }

  function renderPage() {
    book.textContent = "";
    if (!turn) {
      var fullPage = element("div", "sketchbook__full");
      fullPage.appendChild(imageFor(currentPage, "", pages[currentPage].alt));
      book.appendChild(fullPage);
      book.style.setProperty("--book-shade", "0");
    } else {
      var isNext = turn.direction === "next";
      book.appendChild(halfPage("left", isNext ? turn.from : turn.to));
      book.appendChild(halfPage("right", isNext ? turn.to : turn.from));
      book.appendChild(createCurl(turn.direction, turn.from, turn.to));
      updateCurl(turn.progress);
    }

    var previousZone = element("div", "sketchbook__drag-zone sketchbook__drag-zone--previous");
    previousZone.setAttribute("aria-hidden", "true");
    var nextZone = element("div", "sketchbook__drag-zone sketchbook__drag-zone--next");
    nextZone.setAttribute("aria-hidden", "true");
    book.appendChild(previousZone);
    book.appendChild(nextZone);
    book.style.setProperty("--book-width", book.clientWidth + "px");
    updateControls();
  }

  function queueFrame() {
    if (frameId === null) {
      frameTime = performance.now();
      frameId = window.requestAnimationFrame(tick);
    }
  }

  function animateTo(target, callback) {
    spring = { velocity: 0, target: target, callback: callback };
    queueFrame();
  }

  function tick(now) {
    frameId = null;
    var delta = Math.min(0.032, (now - frameTime) / 1000 || 0.016);
    frameTime = now;

    if (spring && turn) {
      var activeSpring = spring;
      var distance = turn.progress - activeSpring.target;
      activeSpring.velocity += (-170 * distance - 26 * activeSpring.velocity) * delta;
      turn.progress += activeSpring.velocity * delta;

      if (
        Math.abs(turn.progress - activeSpring.target) < 0.002 &&
        Math.abs(activeSpring.velocity) < 0.02
      ) {
        turn.progress = activeSpring.target;
        spring = null;
        updateCurl(turn.progress);
        activeSpring.callback();
      } else {
        updateCurl(turn.progress);
      }
    }

    if ((spring || drag) && frameId === null) frameId = window.requestAnimationFrame(tick);
  }

  function beginTurn(direction, progress) {
    spring = null;
    if (turn) {
      currentPage = turn.to;
      turn = null;
    }

    turn = {
      direction: direction,
      from: currentPage,
      to:
        direction === "next"
          ? (currentPage + 1) % pages.length
          : (currentPage - 1 + pages.length) % pages.length,
      progress: progress || 0,
    };
    renderPage();
  }

  function commitTurn() {
    if (!turn) return;
    if (reducedMotion) {
      currentPage = turn.to;
      turn = null;
      renderPage();
      return;
    }

    animateTo(1, function () {
      currentPage = turn.to;
      turn = null;
      renderPage();
    });
  }

  function cancelTurn() {
    if (!turn) return;
    animateTo(0, function () {
      turn = null;
      renderPage();
    });
  }

  function step(direction) {
    if (drag) return;
    beginTurn(direction, 0);
    commitTurn();
  }

  function handlePointerDown(event) {
    if (event.button !== 0 || event.target.closest(".sketchbook__arrow")) return;
    var zone = event.target.closest(".sketchbook__drag-zone");
    if (!zone) return;
    event.preventDefault();
    stage.setPointerCapture(event.pointerId);
    var direction = zone.classList.contains("sketchbook__drag-zone--next") ? "next" : "previous";
    beginTurn(direction, 0);
    drag = {
      direction: direction,
      startX: event.clientX,
      width: Math.max(book.getBoundingClientRect().width, 1),
      moved: 0,
      velocity: 0,
      lastTime: performance.now(),
    };
  }

  function handlePointerMove(event) {
    if (!drag || !turn) return;
    var deltaX = event.clientX - drag.startX;
    drag.moved = Math.max(drag.moved, Math.abs(deltaX));
    var directionFactor = drag.direction === "next" ? -1 : 1;
    var progress = Math.max(0, Math.min(1, (directionFactor * deltaX) / (drag.width * 0.62)));
    var now = performance.now();
    drag.velocity = (progress - turn.progress) / Math.max(0.001, (now - drag.lastTime) / 1000);
    drag.lastTime = now;
    turn.progress = progress;
    updateCurl(progress);
  }

  function handlePointerUp() {
    if (!drag) return;
    var gesture = drag;
    drag = null;
    if (!turn) return;
    if (gesture.moved < 6 || turn.progress > 0.42 || gesture.velocity > 1.1) commitTurn();
    else cancelTurn();
  }

  function updateTilt(event) {
    if (reducedMotion || drag || event.pointerType === "touch") return;
    var bounds = book.getBoundingClientRect();
    var x = (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width * 0.62);
    var y = (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height * 0.9);
    var rotateX = Math.max(-1, Math.min(1, -y)) * 4.5;
    var rotateY = Math.max(-1, Math.min(1, x)) * 7;
    book.style.setProperty("--book-rotate-x", rotateX.toFixed(2) + "deg");
    book.style.setProperty("--book-rotate-y", rotateY.toFixed(2) + "deg");
  }

  function resetTilt() {
    book.style.setProperty("--book-rotate-x", "0deg");
    book.style.setProperty("--book-rotate-y", "0deg");
  }

  function preloadImages() {
    pages.forEach(function (page) {
      var image = new Image();
      image.onload = function () {
        status.textContent = "";
      };
      image.onerror = function () {
        console.error("Unable to load sketchbook image:", page.image);
        status.textContent = "A field-note image could not be loaded.";
      };
      image.src = page.image;
    });
  }

  renderPage();
  previousButton.addEventListener("click", function () {
    step("previous");
  });
  nextButton.addEventListener("click", function () {
    step("next");
  });
  stage.addEventListener("pointerdown", handlePointerDown);
  stage.addEventListener("pointermove", handlePointerMove);
  stage.addEventListener("pointerup", handlePointerUp);
  stage.addEventListener("pointercancel", handlePointerUp);
  stage.addEventListener("pointermove", updateTilt);
  stage.addEventListener("pointerleave", resetTilt);
  stage.addEventListener("dragstart", function (event) {
    event.preventDefault();
  });
  section.addEventListener("keydown", function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step("previous");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step("next");
    }
  });

  window.addEventListener("resize", function () {
    book.style.setProperty("--book-width", book.clientWidth + "px");
  });

  if (!("IntersectionObserver" in window) || reducedMotion) {
    section.classList.add("is-visible");
    preloadImages();
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        section.classList.add("is-visible");
        preloadImages();
        observer.disconnect();
      },
      { threshold: 0.12 },
    );
    observer.observe(section);
  }
})();
