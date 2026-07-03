import {
  Decoration,
  DecorationSet,
  Node as Node2,
  Node3,
  Plugin,
  PluginKey,
  createInlineMarkdownSpec,
  escapeForRegEx,
  mergeAttributes
} from "./chunk-NOJTTDV7.js";
import {
  __objRest,
  __spreadProps,
  __spreadValues
} from "./chunk-GOMI4DH3.js";

// node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs
var sides = ["top", "right", "bottom", "left"];
var alignments = ["start", "end"];
var placements = sides.reduce((acc, side) => acc.concat(side, side + "-" + alignments[0], side + "-" + alignments[1]), []);
var min = Math.min;
var max = Math.max;
var round = Math.round;
var floor = Math.floor;
var createCoords = (v) => ({
  x: v,
  y: v
});
var oppositeSideMap = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function evaluate(value, param) {
  return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
  return placement.split("-")[0];
}
function getAlignment(placement) {
  return placement.split("-")[1];
}
function getOppositeAxis(axis) {
  return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
  return axis === "y" ? "height" : "width";
}
function getSideAxis(placement) {
  const firstChar = placement[0];
  return firstChar === "t" || firstChar === "b" ? "y" : "x";
}
function getAlignmentAxis(placement) {
  return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
  if (rtl === void 0) {
    rtl = false;
  }
  const alignment = getAlignment(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const length = getAxisLength(alignmentAxis);
  let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
  if (rects.reference[length] > rects.floating[length]) {
    mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
  }
  return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
  const oppositePlacement = getOppositePlacement(placement);
  return [getOppositeAlignmentPlacement(placement), oppositePlacement, getOppositeAlignmentPlacement(oppositePlacement)];
}
function getOppositeAlignmentPlacement(placement) {
  return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
}
var lrPlacement = ["left", "right"];
var rlPlacement = ["right", "left"];
var tbPlacement = ["top", "bottom"];
var btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
  switch (side) {
    case "top":
    case "bottom":
      if (rtl) return isStart ? rlPlacement : lrPlacement;
      return isStart ? lrPlacement : rlPlacement;
    case "left":
    case "right":
      return isStart ? tbPlacement : btPlacement;
    default:
      return [];
  }
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
  const alignment = getAlignment(placement);
  let list = getSideList(getSide(placement), direction === "start", rtl);
  if (alignment) {
    list = list.map((side) => side + "-" + alignment);
    if (flipAlignment) {
      list = list.concat(list.map(getOppositeAlignmentPlacement));
    }
  }
  return list;
}
function getOppositePlacement(placement) {
  const side = getSide(placement);
  return oppositeSideMap[side] + placement.slice(side.length);
}
function expandPaddingObject(padding) {
  return __spreadValues({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  }, padding);
}
function getPaddingObject(padding) {
  return typeof padding !== "number" ? expandPaddingObject(padding) : {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding
  };
}
function rectToClientRect(rect) {
  const {
    x,
    y,
    width,
    height
  } = rect;
  return {
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    x,
    y
  };
}

// node_modules/@floating-ui/core/dist/floating-ui.core.mjs
function computeCoordsFromPlacement(_ref, placement, rtl) {
  let {
    reference,
    floating
  } = _ref;
  const sideAxis = getSideAxis(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const alignLength = getAxisLength(alignmentAxis);
  const side = getSide(placement);
  const isVertical = sideAxis === "y";
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
  let coords;
  switch (side) {
    case "top":
      coords = {
        x: commonX,
        y: reference.y - floating.height
      };
      break;
    case "bottom":
      coords = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;
    case "right":
      coords = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;
    case "left":
      coords = {
        x: reference.x - floating.width,
        y: commonY
      };
      break;
    default:
      coords = {
        x: reference.x,
        y: reference.y
      };
  }
  switch (getAlignment(placement)) {
    case "start":
      coords[alignmentAxis] -= commonAlign * (rtl && isVertical ? -1 : 1);
      break;
    case "end":
      coords[alignmentAxis] += commonAlign * (rtl && isVertical ? -1 : 1);
      break;
  }
  return coords;
}
async function detectOverflow(state, options) {
  var _await$platform$isEle;
  if (options === void 0) {
    options = {};
  }
  const {
    x,
    y,
    platform: platform2,
    rects,
    elements,
    strategy
  } = state;
  const {
    boundary = "clippingAncestors",
    rootBoundary = "viewport",
    elementContext = "floating",
    altBoundary = false,
    padding = 0
  } = evaluate(options, state);
  const paddingObject = getPaddingObject(padding);
  const altContext = elementContext === "floating" ? "reference" : "floating";
  const element = elements[altBoundary ? altContext : elementContext];
  const clippingClientRect = rectToClientRect(await platform2.getClippingRect({
    element: ((_await$platform$isEle = await (platform2.isElement == null ? void 0 : platform2.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform2.getDocumentElement == null ? void 0 : platform2.getDocumentElement(elements.floating)),
    boundary,
    rootBoundary,
    strategy
  }));
  const rect = elementContext === "floating" ? {
    x,
    y,
    width: rects.floating.width,
    height: rects.floating.height
  } : rects.reference;
  const offsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(elements.floating));
  const offsetScale = await (platform2.isElement == null ? void 0 : platform2.isElement(offsetParent)) ? await (platform2.getScale == null ? void 0 : platform2.getScale(offsetParent)) || {
    x: 1,
    y: 1
  } : {
    x: 1,
    y: 1
  };
  const elementClientRect = rectToClientRect(platform2.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform2.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements,
    rect,
    offsetParent,
    strategy
  }) : rect);
  return {
    top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
    bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
    left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
    right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
  };
}
var MAX_RESET_COUNT = 50;
var computePosition = async (reference, floating, config) => {
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2
  } = config;
  const platformWithDetectOverflow = platform2.detectOverflow ? platform2 : __spreadProps(__spreadValues({}, platform2), {
    detectOverflow
  });
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(floating));
  let rects = await platform2.getElementRects({
    reference,
    floating,
    strategy
  });
  let {
    x,
    y
  } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;
  let resetCount = 0;
  const middlewareData = {};
  for (let i = 0; i < middleware.length; i++) {
    const currentMiddleware = middleware[i];
    if (!currentMiddleware) {
      continue;
    }
    const {
      name,
      fn
    } = currentMiddleware;
    const {
      x: nextX,
      y: nextY,
      data,
      reset
    } = await fn({
      x,
      y,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform: platformWithDetectOverflow,
      elements: {
        reference,
        floating
      }
    });
    x = nextX != null ? nextX : x;
    y = nextY != null ? nextY : y;
    middlewareData[name] = __spreadValues(__spreadValues({}, middlewareData[name]), data);
    if (reset && resetCount < MAX_RESET_COUNT) {
      resetCount++;
      if (typeof reset === "object") {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects = reset.rects === true ? await platform2.getElementRects({
            reference,
            floating,
            strategy
          }) : reset.rects;
        }
        ({
          x,
          y
        } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i = -1;
    }
  }
  return {
    x,
    y,
    placement: statefulPlacement,
    strategy,
    middlewareData
  };
};
var flip = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "flip",
    options,
    async fn(state) {
      var _middlewareData$arrow, _middlewareData$flip;
      const {
        placement,
        middlewareData,
        rects,
        initialPlacement,
        platform: platform2,
        elements
      } = state;
      const _a = evaluate(options, state), {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true,
        fallbackPlacements: specifiedFallbackPlacements,
        fallbackStrategy = "bestFit",
        fallbackAxisSideDirection = "none",
        flipAlignment = true
      } = _a, detectOverflowOptions = __objRest(_a, [
        "mainAxis",
        "crossAxis",
        "fallbackPlacements",
        "fallbackStrategy",
        "fallbackAxisSideDirection",
        "flipAlignment"
      ]);
      if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      const side = getSide(placement);
      const initialSideAxis = getSideAxis(initialPlacement);
      const isBasePlacement = getSide(initialPlacement) === initialPlacement;
      const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
      const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
      const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
      if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) {
        fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
      }
      const placements2 = [initialPlacement, ...fallbackPlacements];
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const overflows = [];
      let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
      if (checkMainAxis) {
        overflows.push(overflow[side]);
      }
      if (checkCrossAxis) {
        const sides2 = getAlignmentSides(placement, rects, rtl);
        overflows.push(overflow[sides2[0]], overflow[sides2[1]]);
      }
      overflowsData = [...overflowsData, {
        placement,
        overflows
      }];
      if (!overflows.every((side2) => side2 <= 0)) {
        var _middlewareData$flip2, _overflowsData$filter;
        const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
        const nextPlacement = placements2[nextIndex];
        if (nextPlacement) {
          const ignoreCrossAxisOverflow = checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false;
          if (!ignoreCrossAxisOverflow || // We leave the current main axis only if every placement on that axis
          // overflows the main axis.
          overflowsData.every((d) => getSideAxis(d.placement) === initialSideAxis ? d.overflows[0] > 0 : true)) {
            return {
              data: {
                index: nextIndex,
                overflows: overflowsData
              },
              reset: {
                placement: nextPlacement
              }
            };
          }
        }
        let resetPlacement = (_overflowsData$filter = overflowsData.filter((d) => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
        if (!resetPlacement) {
          switch (fallbackStrategy) {
            case "bestFit": {
              var _overflowsData$filter2;
              const placement2 = (_overflowsData$filter2 = overflowsData.filter((d) => {
                if (hasFallbackAxisSideDirection) {
                  const currentSideAxis = getSideAxis(d.placement);
                  return currentSideAxis === initialSideAxis || // Create a bias to the `y` side axis due to horizontal
                  // reading directions favoring greater width.
                  currentSideAxis === "y";
                }
                return true;
              }).map((d) => [d.placement, d.overflows.filter((overflow2) => overflow2 > 0).reduce((acc, overflow2) => acc + overflow2, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
              if (placement2) {
                resetPlacement = placement2;
              }
              break;
            }
            case "initialPlacement":
              resetPlacement = initialPlacement;
              break;
          }
        }
        if (placement !== resetPlacement) {
          return {
            reset: {
              placement: resetPlacement
            }
          };
        }
      }
      return {};
    }
  };
};
var originSides = /* @__PURE__ */ new Set(["left", "top"]);
async function convertValueToCoords(state, options) {
  const {
    placement,
    platform: platform2,
    elements
  } = state;
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
  const side = getSide(placement);
  const alignment = getAlignment(placement);
  const isVertical = getSideAxis(placement) === "y";
  const mainAxisMulti = originSides.has(side) ? -1 : 1;
  const crossAxisMulti = rtl && isVertical ? -1 : 1;
  const rawValue = evaluate(options, state);
  let {
    mainAxis,
    crossAxis,
    alignmentAxis
  } = typeof rawValue === "number" ? {
    mainAxis: rawValue,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: rawValue.mainAxis || 0,
    crossAxis: rawValue.crossAxis || 0,
    alignmentAxis: rawValue.alignmentAxis
  };
  if (alignment && typeof alignmentAxis === "number") {
    crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
  }
  return isVertical ? {
    x: crossAxis * crossAxisMulti,
    y: mainAxis * mainAxisMulti
  } : {
    x: mainAxis * mainAxisMulti,
    y: crossAxis * crossAxisMulti
  };
}
var offset = function(options) {
  if (options === void 0) {
    options = 0;
  }
  return {
    name: "offset",
    options,
    async fn(state) {
      var _middlewareData$offse, _middlewareData$arrow;
      const {
        x,
        y,
        placement,
        middlewareData
      } = state;
      const diffCoords = await convertValueToCoords(state, options);
      if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      return {
        x: x + diffCoords.x,
        y: y + diffCoords.y,
        data: __spreadProps(__spreadValues({}, diffCoords), {
          placement
        })
      };
    }
  };
};

// node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function hasWindow() {
  return typeof window !== "undefined";
}
function getNodeName(node) {
  if (isNode(node)) {
    return (node.nodeName || "").toLowerCase();
  }
  return "#document";
}
function getWindow(node) {
  var _node$ownerDocument;
  return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
  var _ref;
  return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
  if (!hasWindow() || typeof ShadowRoot === "undefined") {
    return false;
  }
  return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
  const {
    overflow,
    overflowX,
    overflowY,
    display
  } = getComputedStyle2(element);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && display !== "inline" && display !== "contents";
}
function isTableElement(element) {
  return /^(table|td|th)$/.test(getNodeName(element));
}
function isTopLayer(element) {
  try {
    if (element.matches(":popover-open")) {
      return true;
    }
  } catch (_e) {
  }
  try {
    return element.matches(":modal");
  } catch (_e) {
    return false;
  }
}
var willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
var containRe = /paint|layout|strict|content/;
var isNotNone = (value) => !!value && value !== "none";
var isWebKitValue;
function isContainingBlock(elementOrCss) {
  const css = isElement(elementOrCss) ? getComputedStyle2(elementOrCss) : elementOrCss;
  return isNotNone(css.transform) || isNotNone(css.translate) || isNotNone(css.scale) || isNotNone(css.rotate) || isNotNone(css.perspective) || !isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter)) || willChangeRe.test(css.willChange || "") || containRe.test(css.contain || "");
}
function getContainingBlock(element) {
  let currentNode = getParentNode(element);
  while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
    if (isContainingBlock(currentNode)) {
      return currentNode;
    } else if (isTopLayer(currentNode)) {
      return null;
    }
    currentNode = getParentNode(currentNode);
  }
  return null;
}
function isWebKit() {
  if (isWebKitValue == null) {
    isWebKitValue = typeof CSS !== "undefined" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none");
  }
  return isWebKitValue;
}
function isLastTraversableNode(node) {
  return /^(html|body|#document)$/.test(getNodeName(node));
}
function getComputedStyle2(element) {
  return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
  if (isElement(element)) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }
  return {
    scrollLeft: element.scrollX,
    scrollTop: element.scrollY
  };
}
function getParentNode(node) {
  if (getNodeName(node) === "html") {
    return node;
  }
  const result = (
    // Step into the shadow DOM of the parent of a slotted node.
    node.assignedSlot || // DOM Element detected.
    node.parentNode || // ShadowRoot detected.
    isShadowRoot(node) && node.host || // Fallback.
    getDocumentElement(node)
  );
  return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
  const parentNode = getParentNode(node);
  if (isLastTraversableNode(parentNode)) {
    return node.ownerDocument ? node.ownerDocument.body : node.body;
  }
  if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
    return parentNode;
  }
  return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
  var _node$ownerDocument2;
  if (list === void 0) {
    list = [];
  }
  if (traverseIframes === void 0) {
    traverseIframes = true;
  }
  const scrollableAncestor = getNearestOverflowAncestor(node);
  const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
  const win = getWindow(scrollableAncestor);
  if (isBody) {
    const frameElement = getFrameElement(win);
    return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
  } else {
    return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
  }
}
function getFrameElement(win) {
  return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}

// node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs
function getCssDimensions(element) {
  const css = getComputedStyle2(element);
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }
  return {
    width,
    height,
    $: shouldFallback
  };
}
function unwrapElement(element) {
  return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
  const domElement = unwrapElement(element);
  if (!isHTMLElement(domElement)) {
    return createCoords(1);
  }
  const rect = domElement.getBoundingClientRect();
  const {
    width,
    height,
    $
  } = getCssDimensions(domElement);
  let x = ($ ? round(rect.width) : rect.width) / width;
  let y = ($ ? round(rect.height) : rect.height) / height;
  if (!x || !Number.isFinite(x)) {
    x = 1;
  }
  if (!y || !Number.isFinite(y)) {
    y = 1;
  }
  return {
    x,
    y
  };
}
var noOffsets = createCoords(0);
function getVisualOffsets(element) {
  const win = getWindow(element);
  if (!isWebKit() || !win.visualViewport) {
    return noOffsets;
  }
  return {
    x: win.visualViewport.offsetLeft,
    y: win.visualViewport.offsetTop
  };
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  if (!floatingOffsetParent || isFixed && floatingOffsetParent !== getWindow(element)) {
    return false;
  }
  return isFixed;
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  const clientRect = element.getBoundingClientRect();
  const domElement = unwrapElement(element);
  let scale = createCoords(1);
  if (includeScale) {
    if (offsetParent) {
      if (isElement(offsetParent)) {
        scale = getScale(offsetParent);
      }
    } else {
      scale = getScale(element);
    }
  }
  const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
  let x = (clientRect.left + visualOffsets.x) / scale.x;
  let y = (clientRect.top + visualOffsets.y) / scale.y;
  let width = clientRect.width / scale.x;
  let height = clientRect.height / scale.y;
  if (domElement) {
    const win = getWindow(domElement);
    const offsetWin = offsetParent && isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
    let currentWin = win;
    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetParent && offsetWin !== currentWin) {
      const iframeScale = getScale(currentIFrame);
      const iframeRect = currentIFrame.getBoundingClientRect();
      const css = getComputedStyle2(currentIFrame);
      const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
      const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
      x *= iframeScale.x;
      y *= iframeScale.y;
      width *= iframeScale.x;
      height *= iframeScale.y;
      x += left;
      y += top;
      currentWin = getWindow(currentIFrame);
      currentIFrame = getFrameElement(currentWin);
    }
  }
  return rectToClientRect({
    width,
    height,
    x,
    y
  });
}
function getWindowScrollBarX(element, rect) {
  const leftScroll = getNodeScroll(element).scrollLeft;
  if (!rect) {
    return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
  }
  return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
  const htmlRect = documentElement.getBoundingClientRect();
  const x = htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect);
  const y = htmlRect.top + scroll.scrollTop;
  return {
    x,
    y
  };
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
  let {
    elements,
    rect,
    offsetParent,
    strategy
  } = _ref;
  const isFixed = strategy === "fixed";
  const documentElement = getDocumentElement(offsetParent);
  const topLayer = elements ? isTopLayer(elements.floating) : false;
  if (offsetParent === documentElement || topLayer && isFixed) {
    return rect;
  }
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  let scale = createCoords(1);
  const offsets = createCoords(0);
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent);
      scale = getScale(offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  return {
    width: rect.width * scale.x,
    height: rect.height * scale.y,
    x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
    y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
  };
}
function getClientRects(element) {
  return Array.from(element.getClientRects());
}
function getDocumentRect(element) {
  const html = getDocumentElement(element);
  const scroll = getNodeScroll(element);
  const body = element.ownerDocument.body;
  const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
  const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
  let x = -scroll.scrollLeft + getWindowScrollBarX(element);
  const y = -scroll.scrollTop;
  if (getComputedStyle2(body).direction === "rtl") {
    x += max(html.clientWidth, body.clientWidth) - width;
  }
  return {
    width,
    height,
    x,
    y
  };
}
var SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy) {
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x = 0;
  let y = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    const visualViewportBased = isWebKit();
    if (!visualViewportBased || visualViewportBased && strategy === "fixed") {
      x = visualViewport.offsetLeft;
      y = visualViewport.offsetTop;
    }
  }
  const windowScrollbarX = getWindowScrollBarX(html);
  if (windowScrollbarX <= 0) {
    const doc = html.ownerDocument;
    const body = doc.body;
    const bodyStyles = getComputedStyle(body);
    const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
    const clippingStableScrollbarWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
    if (clippingStableScrollbarWidth <= SCROLLBAR_MAX) {
      width -= clippingStableScrollbarWidth;
    }
  } else if (windowScrollbarX <= SCROLLBAR_MAX) {
    width += windowScrollbarX;
  }
  return {
    width,
    height,
    x,
    y
  };
}
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  const scale = isHTMLElement(element) ? getScale(element) : createCoords(1);
  const width = element.clientWidth * scale.x;
  const height = element.clientHeight * scale.y;
  const x = left * scale.x;
  const y = top * scale.y;
  return {
    width,
    height,
    x,
    y
  };
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
  let rect;
  if (clippingAncestor === "viewport") {
    rect = getViewportRect(element, strategy);
  } else if (clippingAncestor === "document") {
    rect = getDocumentRect(getDocumentElement(element));
  } else if (isElement(clippingAncestor)) {
    rect = getInnerBoundingClientRect(clippingAncestor, strategy);
  } else {
    const visualOffsets = getVisualOffsets(element);
    rect = {
      x: clippingAncestor.x - visualOffsets.x,
      y: clippingAncestor.y - visualOffsets.y,
      width: clippingAncestor.width,
      height: clippingAncestor.height
    };
  }
  return rectToClientRect(rect);
}
function hasFixedPositionAncestor(element, stopNode) {
  const parentNode = getParentNode(element);
  if (parentNode === stopNode || !isElement(parentNode) || isLastTraversableNode(parentNode)) {
    return false;
  }
  return getComputedStyle2(parentNode).position === "fixed" || hasFixedPositionAncestor(parentNode, stopNode);
}
function getClippingElementAncestors(element, cache) {
  const cachedResult = cache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
  let currentContainingBlockComputedStyle = null;
  const elementIsFixed = getComputedStyle2(element).position === "fixed";
  let currentNode = elementIsFixed ? getParentNode(element) : element;
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = getComputedStyle2(currentNode);
    const currentNodeIsContaining = isContainingBlock(currentNode);
    if (!currentNodeIsContaining && computedStyle.position === "fixed") {
      currentContainingBlockComputedStyle = null;
    }
    const shouldDropCurrentNode = elementIsFixed ? !currentNodeIsContaining && !currentContainingBlockComputedStyle : !currentNodeIsContaining && computedStyle.position === "static" && !!currentContainingBlockComputedStyle && (currentContainingBlockComputedStyle.position === "absolute" || currentContainingBlockComputedStyle.position === "fixed") || isOverflowElement(currentNode) && !currentNodeIsContaining && hasFixedPositionAncestor(element, currentNode);
    if (shouldDropCurrentNode) {
      result = result.filter((ancestor) => ancestor !== currentNode);
    } else {
      currentContainingBlockComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  cache.set(element, result);
  return result;
}
function getClippingRect(_ref) {
  let {
    element,
    boundary,
    rootBoundary,
    strategy
  } = _ref;
  const elementClippingAncestors = boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
  let top = firstRect.top;
  let right = firstRect.right;
  let bottom = firstRect.bottom;
  let left = firstRect.left;
  for (let i = 1; i < clippingAncestors.length; i++) {
    const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i], strategy);
    top = max(rect.top, top);
    right = min(rect.right, right);
    bottom = min(rect.bottom, bottom);
    left = max(rect.left, left);
  }
  return {
    width: right - left,
    height: bottom - top,
    x: left,
    y: top
  };
}
function getDimensions(element) {
  const {
    width,
    height
  } = getCssDimensions(element);
  return {
    width,
    height
  };
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const isFixed = strategy === "fixed";
  const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const offsets = createCoords(0);
  function setLeftRTLScrollbarOffset() {
    offsets.x = getWindowScrollBarX(documentElement);
  }
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    } else if (documentElement) {
      setLeftRTLScrollbarOffset();
    }
  }
  if (isFixed && !isOffsetParentAnElement && documentElement) {
    setLeftRTLScrollbarOffset();
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  const x = rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x;
  const y = rect.top + scroll.scrollTop - offsets.y - htmlOffset.y;
  return {
    x,
    y,
    width: rect.width,
    height: rect.height
  };
}
function isStaticPositioned(element) {
  return getComputedStyle2(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
  if (!isHTMLElement(element) || getComputedStyle2(element).position === "fixed") {
    return null;
  }
  if (polyfill) {
    return polyfill(element);
  }
  let rawOffsetParent = element.offsetParent;
  if (getDocumentElement(element) === rawOffsetParent) {
    rawOffsetParent = rawOffsetParent.ownerDocument.body;
  }
  return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
  const win = getWindow(element);
  if (isTopLayer(element)) {
    return win;
  }
  if (!isHTMLElement(element)) {
    let svgOffsetParent = getParentNode(element);
    while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
      if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) {
        return svgOffsetParent;
      }
      svgOffsetParent = getParentNode(svgOffsetParent);
    }
    return win;
  }
  let offsetParent = getTrueOffsetParent(element, polyfill);
  while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent, polyfill);
  }
  if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) {
    return win;
  }
  return offsetParent || getContainingBlock(element) || win;
}
var getElementRects = async function(data) {
  const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
  const getDimensionsFn = this.getDimensions;
  const floatingDimensions = await getDimensionsFn(data.floating);
  return {
    reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
    floating: {
      x: 0,
      y: 0,
      width: floatingDimensions.width,
      height: floatingDimensions.height
    }
  };
};
function isRTL(element) {
  return getComputedStyle2(element).direction === "rtl";
}
var platform = {
  convertOffsetParentRelativeRectToViewportRelativeRect,
  getDocumentElement,
  getClippingRect,
  getOffsetParent,
  getElementRects,
  getClientRects,
  getDimensions,
  getScale,
  isElement,
  isRTL
};
function rectsAreEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function observeMove(element, onMove) {
  let io = null;
  let timeoutId;
  const root = getDocumentElement(element);
  function cleanup() {
    var _io;
    clearTimeout(timeoutId);
    (_io = io) == null || _io.disconnect();
    io = null;
  }
  function refresh(skip, threshold) {
    if (skip === void 0) {
      skip = false;
    }
    if (threshold === void 0) {
      threshold = 1;
    }
    cleanup();
    const elementRectForRootMargin = element.getBoundingClientRect();
    const {
      left,
      top,
      width,
      height
    } = elementRectForRootMargin;
    if (!skip) {
      onMove();
    }
    if (!width || !height) {
      return;
    }
    const insetTop = floor(top);
    const insetRight = floor(root.clientWidth - (left + width));
    const insetBottom = floor(root.clientHeight - (top + height));
    const insetLeft = floor(left);
    const rootMargin = -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px";
    const options = {
      rootMargin,
      threshold: max(0, min(1, threshold)) || 1
    };
    let isFirstUpdate = true;
    function handleObserve(entries) {
      const ratio = entries[0].intersectionRatio;
      if (ratio !== threshold) {
        if (!isFirstUpdate) {
          return refresh();
        }
        if (!ratio) {
          timeoutId = setTimeout(() => {
            refresh(false, 1e-7);
          }, 1e3);
        } else {
          refresh(false, ratio);
        }
      }
      if (ratio === 1 && !rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) {
        refresh();
      }
      isFirstUpdate = false;
    }
    try {
      io = new IntersectionObserver(handleObserve, __spreadProps(__spreadValues({}, options), {
        // Handle <iframe>s
        root: root.ownerDocument
      }));
    } catch (_e) {
      io = new IntersectionObserver(handleObserve, options);
    }
    io.observe(element);
  }
  refresh(true);
  return cleanup;
}
function autoUpdate(reference, floating, update, options) {
  if (options === void 0) {
    options = {};
  }
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = typeof ResizeObserver === "function",
    layoutShift = typeof IntersectionObserver === "function",
    animationFrame = false
  } = options;
  const referenceEl = unwrapElement(reference);
  const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
  ancestors.forEach((ancestor) => {
    ancestorScroll && ancestor.addEventListener("scroll", update, {
      passive: true
    });
    ancestorResize && ancestor.addEventListener("resize", update);
  });
  const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update) : null;
  let reobserveFrame = -1;
  let resizeObserver = null;
  if (elementResize) {
    resizeObserver = new ResizeObserver((_ref) => {
      let [firstEntry] = _ref;
      if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
        resizeObserver.unobserve(floating);
        cancelAnimationFrame(reobserveFrame);
        reobserveFrame = requestAnimationFrame(() => {
          var _resizeObserver;
          (_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
        });
      }
      update();
    });
    if (referenceEl && !animationFrame) {
      resizeObserver.observe(referenceEl);
    }
    if (floating) {
      resizeObserver.observe(floating);
    }
  }
  let frameId;
  let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
  if (animationFrame) {
    frameLoop();
  }
  function frameLoop() {
    const nextRefRect = getBoundingClientRect(reference);
    if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) {
      update();
    }
    prevRefRect = nextRefRect;
    frameId = requestAnimationFrame(frameLoop);
  }
  update();
  return () => {
    var _resizeObserver2;
    ancestors.forEach((ancestor) => {
      ancestorScroll && ancestor.removeEventListener("scroll", update);
      ancestorResize && ancestor.removeEventListener("resize", update);
    });
    cleanupIo == null || cleanupIo();
    (_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
    resizeObserver = null;
    if (animationFrame) {
      cancelAnimationFrame(frameId);
    }
  };
}
var offset2 = offset;
var flip2 = flip;
var computePosition2 = (reference, floating, options) => {
  const cache = /* @__PURE__ */ new Map();
  const mergedOptions = __spreadValues({
    platform
  }, options);
  const platformWithCache = __spreadProps(__spreadValues({}, mergedOptions.platform), {
    _c: cache
  });
  return computePosition(reference, floating, __spreadProps(__spreadValues({}, mergedOptions), {
    platform: platformWithCache
  }));
};

// node_modules/@tiptap/suggestion/dist/index.js
function findSuggestionMatch(config) {
  var _a;
  const {
    char,
    allowSpaces: allowSpacesOption,
    allowToIncludeChar,
    allowedPrefixes,
    startOfLine,
    $position
  } = config;
  const allowSpaces = allowSpacesOption && !allowToIncludeChar;
  const escapedChar = escapeForRegEx(char);
  const suffix = new RegExp(`\\s${escapedChar}$`);
  const prefix = startOfLine ? "^" : "";
  const finalEscapedChar = allowToIncludeChar ? "" : escapedChar;
  const regexp = allowSpaces ? new RegExp(`${prefix}${escapedChar}.*?(?=\\s${finalEscapedChar}|$)`, "gm") : new RegExp(`${prefix}(?:^)?${escapedChar}[^\\s${finalEscapedChar}]*`, "gm");
  const text = ((_a = $position.nodeBefore) == null ? void 0 : _a.isText) && $position.nodeBefore.text;
  if (!text) {
    return null;
  }
  const textFrom = $position.pos - text.length;
  const match = Array.from(text.matchAll(regexp)).pop();
  if (!match || match.input === void 0 || match.index === void 0) {
    return null;
  }
  const matchPrefix = match.input.slice(Math.max(0, match.index - 1), match.index);
  const matchPrefixIsAllowed = new RegExp(`^[${allowedPrefixes == null ? void 0 : allowedPrefixes.join("")}\0]?$`).test(matchPrefix);
  if (allowedPrefixes !== null && !matchPrefixIsAllowed) {
    return null;
  }
  const from = textFrom + match.index;
  let to = from + match[0].length;
  if (allowSpaces && suffix.test(text.slice(to - 1, to + 1))) {
    match[0] += " ";
    to += 1;
  }
  if (from < $position.pos && to >= $position.pos) {
    return {
      range: {
        from,
        to
      },
      query: match[0].slice(char.length),
      text: match[0]
    };
  }
  return null;
}
function hasInsertedWhitespace(transaction) {
  if (!transaction.docChanged) {
    return false;
  }
  return transaction.steps.some((step) => {
    const slice = step.slice;
    if (!(slice == null ? void 0 : slice.content)) {
      return false;
    }
    const inserted = slice.content.textBetween(0, slice.content.size, "\n");
    return /\s/.test(inserted);
  });
}
function getAnchorClientRect(editor) {
  return () => {
    const pos = editor.state.selection.$anchor.pos;
    const coords = editor.view.coordsAtPos(pos);
    const { top, right, bottom, left } = coords;
    try {
      return new DOMRect(left, top, right - left, bottom - top);
    } catch {
      return null;
    }
  };
}
function clientRectFor(editor, view, decorationNode, pluginKey) {
  if (!decorationNode) {
    return getAnchorClientRect(editor);
  }
  return () => {
    const state = pluginKey.getState(editor.state);
    const decorationId = state == null ? void 0 : state.decorationId;
    const currentDecorationNode = view.dom.querySelector(`[data-decoration-id="${decorationId}"]`);
    return (currentDecorationNode == null ? void 0 : currentDecorationNode.getBoundingClientRect()) || null;
  };
}
function shouldKeepDismissed({
  match,
  dismissedRange,
  state,
  transaction,
  editor,
  shouldResetDismissed,
  effectiveAllowSpaces
}) {
  if (shouldResetDismissed == null ? void 0 : shouldResetDismissed({
    editor,
    state,
    range: dismissedRange,
    match,
    transaction,
    allowSpaces: effectiveAllowSpaces
  })) {
    return false;
  }
  if (effectiveAllowSpaces) {
    return match.range.from === dismissedRange.from;
  }
  return match.range.from === dismissedRange.from && !hasInsertedWhitespace(transaction);
}
function dispatchExit({
  view,
  pluginKeyRef
}) {
  const tr = view.state.tr.setMeta(pluginKeyRef, { exit: true });
  view.dispatch(tr);
}
function createSuggestionProps({
  pluginKey,
  decorationTag,
  decorationClass,
  decorationContent,
  decorationEmptyClass,
  renderer,
  dispatchExit: dispatchExit2
}) {
  return {
    /**
     * Call the keydown hook if suggestion is active.
     */
    handleKeyDown(view, event) {
      var _a, _b;
      const state = pluginKey.getState(view.state);
      if (!state.active) {
        return false;
      }
      if (event.key === "Escape" || event.key === "Esc") {
        (_a = renderer == null ? void 0 : renderer.onKeyDown) == null ? void 0 : _a.call(renderer, { view, event, range: state.range });
        dispatchExit2(view);
        return true;
      }
      const handled = ((_b = renderer == null ? void 0 : renderer.onKeyDown) == null ? void 0 : _b.call(renderer, { view, event, range: state.range })) || false;
      return handled;
    },
    /**
     * Setup decorator on the currently active suggestion.
     */
    decorations(state) {
      const pluginState = pluginKey.getState(state);
      const { active, range, decorationId, query } = pluginState;
      if (!active) {
        return null;
      }
      const isEmpty = !(query == null ? void 0 : query.length);
      const classNames = [decorationClass];
      if (isEmpty) {
        classNames.push(decorationEmptyClass);
      }
      return DecorationSet.create(state.doc, [
        Decoration.inline(range.from, range.to, {
          nodeName: decorationTag,
          class: classNames.join(" "),
          "data-decoration-id": decorationId || void 0,
          "data-decoration-content": decorationContent
        })
      ]);
    }
  };
}
function createSuggestionState({
  editor,
  char,
  effectiveAllowSpaces,
  allowToIncludeChar,
  allowedPrefixes,
  startOfLine,
  findSuggestionMatch: findSuggestionMatch2,
  allow,
  shouldShow,
  shouldKeepDismissed: shouldKeepDismissed2,
  pluginKey
}) {
  return {
    /**
     * Initialize the plugin's internal state.
     */
    init() {
      return {
        active: false,
        range: { from: 0, to: 0 },
        query: null,
        text: null,
        composing: false,
        dismissedRange: null
      };
    },
    /**
     * Apply changes to the plugin state from a view transaction.
     */
    apply(transaction, prev, _oldState, state) {
      const { isEditable } = editor;
      const { composing } = editor.view;
      const { selection } = transaction;
      const { empty, from } = selection;
      const next = __spreadValues({}, prev);
      const meta = transaction.getMeta(pluginKey);
      if (meta && meta.exit) {
        next.active = false;
        next.decorationId = null;
        next.range = { from: 0, to: 0 };
        next.query = null;
        next.text = null;
        next.dismissedRange = prev.active ? __spreadValues({}, prev.range) : prev.dismissedRange;
        return next;
      }
      next.composing = composing;
      if (transaction.docChanged && next.dismissedRange !== null) {
        next.dismissedRange = {
          from: transaction.mapping.map(next.dismissedRange.from),
          to: transaction.mapping.map(next.dismissedRange.to)
        };
      }
      if (isEditable && (empty || editor.view.composing)) {
        if ((from < prev.range.from || from > prev.range.to) && !composing && !prev.composing) {
          next.active = false;
        }
        const match = findSuggestionMatch2({
          char,
          allowSpaces: effectiveAllowSpaces,
          allowToIncludeChar,
          allowedPrefixes,
          startOfLine,
          $position: selection.$from
        });
        const decorationId = `id_${Math.floor(Math.random() * 4294967295)}`;
        if (match && allow({
          editor,
          state,
          range: match.range,
          isActive: prev.active
        }) && (!shouldShow || shouldShow({
          editor,
          range: match.range,
          query: match.query,
          text: match.text,
          transaction
        }))) {
          if (next.dismissedRange !== null && !shouldKeepDismissed2({
            match,
            dismissedRange: next.dismissedRange,
            state,
            transaction
          })) {
            next.dismissedRange = null;
          }
          if (next.dismissedRange === null) {
            next.active = true;
            next.decorationId = prev.decorationId || decorationId;
            next.range = match.range;
            next.query = match.query;
            next.text = match.text;
          } else {
            next.active = false;
          }
        } else {
          if (!match) {
            next.dismissedRange = null;
          }
          next.active = false;
        }
      } else {
        next.active = false;
      }
      if (!next.active) {
        next.decorationId = null;
        next.range = { from: 0, to: 0 };
        next.query = null;
        next.text = null;
      }
      return next;
    }
  };
}
function createSuggestionAsyncRequestManager({
  editor,
  items
}) {
  let abortController = null;
  let debounceTimer = null;
  let debounceResolve = null;
  const clearDebounceTimer = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    debounceResolve == null ? void 0 : debounceResolve();
    debounceResolve = null;
  };
  const waitForDebounce = (delay) => {
    return new Promise((resolve) => {
      debounceResolve = resolve;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const pendingResolve = debounceResolve;
        debounceResolve = null;
        pendingResolve == null ? void 0 : pendingResolve();
      }, delay);
    });
  };
  const abort = () => {
    abortController == null ? void 0 : abortController.abort();
    clearDebounceTimer();
    abortController = null;
  };
  const fetch = async (query, debounce) => {
    abort();
    abortController = new AbortController();
    const controller = abortController;
    if (debounce > 0) {
      await waitForDebounce(debounce);
    }
    if (abortController !== controller || controller.signal.aborted) {
      return { status: "aborted" };
    }
    try {
      const result = await items({
        editor,
        query,
        signal: controller.signal
      });
      if (abortController !== controller || controller.signal.aborted) {
        return { status: "aborted" };
      }
      return { status: "resolved", items: result };
    } catch {
      if (abortController !== controller || controller.signal.aborted) {
        return { status: "aborted" };
      }
      return { status: "error" };
    }
  };
  return {
    abort,
    fetch
  };
}
function createSuggestionFloatingUiConfig({
  placement,
  offset: offset3,
  flip: flip3,
  floatingUi
}) {
  var _a, _b, _c, _d;
  const middleware = [
    offset2({
      mainAxis: (_a = offset3.mainAxis) != null ? _a : 4,
      crossAxis: (_b = offset3.crossAxis) != null ? _b : 0
    })
  ];
  if (flip3) {
    middleware.push(flip2());
  }
  if ((_c = floatingUi == null ? void 0 : floatingUi.middleware) == null ? void 0 : _c.length) {
    middleware.push(...floatingUi.middleware);
  }
  return {
    placement,
    strategy: (_d = floatingUi == null ? void 0 : floatingUi.strategy) != null ? _d : "absolute",
    middleware
  };
}
function resolveContainer(container) {
  if (container instanceof HTMLElement) {
    return container;
  }
  if (typeof container === "string") {
    try {
      const found = document.querySelector(container);
      if (found) {
        return found;
      }
    } catch {
      return document.body;
    }
  }
  return document.body;
}
function createMount({
  getReferenceRect,
  contextElement,
  config,
  container,
  dismissOnOutsideClick,
  dismiss
}) {
  return (element, options = {}) => {
    const reference = {
      getBoundingClientRect: () => {
        var _a;
        return (_a = getReferenceRect()) != null ? _a : new DOMRect();
      },
      contextElement
    };
    let positioned = false;
    const mountedByUs = !element.isConnected;
    if (mountedByUs) {
      resolveContainer(container).appendChild(element);
    }
    if (!options.onPosition) {
      element.style.visibility = "hidden";
      element.style.width = "max-content";
    }
    const update = () => {
      computePosition2(reference, element, {
        placement: config.placement,
        strategy: config.strategy,
        middleware: config.middleware
      }).then(({ x, y, placement, strategy }) => {
        if (options.onPosition) {
          options.onPosition({ x, y, placement, strategy });
          return;
        }
        Object.assign(element.style, {
          position: strategy,
          left: `${x}px`,
          top: `${y}px`
        });
        if (!positioned) {
          positioned = true;
          element.style.visibility = "";
        }
      });
    };
    const cleanupAutoUpdate = autoUpdate(reference, element, update, options.autoUpdate);
    let onOutsidePointerDown;
    if (dismissOnOutsideClick) {
      onOutsidePointerDown = (event) => {
        const target = event.target;
        if (!(target instanceof Node) || element.contains(target) || contextElement.contains(target)) {
          return;
        }
        dismiss();
      };
      document.addEventListener("pointerdown", onOutsidePointerDown, true);
    }
    return () => {
      cleanupAutoUpdate();
      if (onOutsidePointerDown) {
        document.removeEventListener("pointerdown", onOutsidePointerDown, true);
      }
      if (mountedByUs) {
        element.remove();
      }
    };
  };
}
function createSuggestionView({
  editor,
  pluginKey,
  items,
  renderer,
  minQueryLength,
  debounce,
  initialItems,
  placement,
  offset: offsetOption,
  container,
  flip: flip3,
  floatingUi,
  dismissOnOutsideClick,
  command,
  clientRectFor: clientRectFor2,
  dispatchExit: dispatchExit2
}) {
  let props;
  const asyncRequest = createSuggestionAsyncRequestManager({
    editor,
    items
  });
  const floatingUiConfig = createSuggestionFloatingUiConfig({
    placement,
    offset: offsetOption,
    flip: flip3,
    floatingUi
  });
  function dispatchStateUpdate(state, dispatchProps) {
    var _a, _b, _c;
    switch (state) {
      case "started":
        (_a = renderer == null ? void 0 : renderer.onStart) == null ? void 0 : _a.call(renderer, dispatchProps);
        break;
      case "updated":
        (_b = renderer == null ? void 0 : renderer.onUpdate) == null ? void 0 : _b.call(renderer, dispatchProps);
        break;
      case "stopped":
        (_c = renderer == null ? void 0 : renderer.onExit) == null ? void 0 : _c.call(renderer, dispatchProps);
        break;
      default:
        break;
    }
  }
  return {
    update: async (view, prevState) => {
      var _a, _b, _c, _d;
      const prev = pluginKey.getState(prevState);
      const next = pluginKey.getState(view.state);
      if (!prev || !next) {
        return;
      }
      let currentState = null;
      const queryChanged = prev.query !== next.query;
      const textChanged = prev.text !== next.text;
      const rangeChanged = prev.range.from !== next.range.from || prev.range.to !== next.range.to;
      const effectiveQueryChanged = queryChanged || textChanged || rangeChanged;
      if (!prev.active && next.active) {
        currentState = "started";
      } else if (prev.active && !next.active) {
        currentState = "stopped";
      } else if (next.active && effectiveQueryChanged) {
        currentState = "updated";
      } else {
        return;
      }
      const state = currentState === "stopped" ? prev : next;
      const decorationNode = view.dom.querySelector(`[data-decoration-id="${state.decorationId}"]`);
      const clientRect = clientRectFor2(view, decorationNode);
      const exceedsMinQueryLength = minQueryLength === 0 || (state.query ? state.query.length >= minQueryLength : false);
      const willFetch = (currentState === "started" || currentState === "updated") && exceedsMinQueryLength;
      props = {
        editor,
        range: state.range,
        query: state.query || "",
        text: state.text || "",
        items: initialItems != null ? initialItems : [],
        command: (commandProps) => {
          return command({
            editor,
            range: state.range,
            props: commandProps
          });
        },
        decorationNode,
        clientRect,
        loading: willFetch,
        placement,
        offset: { mainAxis: (_a = offsetOption.mainAxis) != null ? _a : 4, crossAxis: (_b = offsetOption.crossAxis) != null ? _b : 0 },
        container,
        flip: flip3,
        floatingUi: floatingUiConfig,
        mount: createMount({
          getReferenceRect: clientRect,
          contextElement: view.dom,
          config: floatingUiConfig,
          container,
          dismissOnOutsideClick,
          dismiss: () => dispatchExit2(editor.view)
        })
      };
      if (currentState === "started") {
        (_c = renderer == null ? void 0 : renderer.onBeforeStart) == null ? void 0 : _c.call(renderer, props);
      }
      if (currentState === "updated") {
        (_d = renderer == null ? void 0 : renderer.onBeforeUpdate) == null ? void 0 : _d.call(renderer, props);
      }
      if (currentState === "started") {
        dispatchStateUpdate(currentState, props);
      }
      if (currentState === "started" || currentState === "updated") {
        if (!willFetch) {
          asyncRequest.abort();
          props = __spreadProps(__spreadValues({}, props), { items: initialItems != null ? initialItems : [], loading: false });
        } else {
          props = __spreadProps(__spreadValues({}, props), { items: initialItems != null ? initialItems : [], loading: true });
          currentState = "updated";
          dispatchStateUpdate(currentState, props);
          const result = await asyncRequest.fetch(state.query || "", debounce);
          if (result.status === "aborted") {
            return;
          }
          const currentPluginState = pluginKey.getState(view.state);
          if (!(currentPluginState == null ? void 0 : currentPluginState.active)) {
            asyncRequest.abort();
            return;
          }
          props = result.status === "resolved" ? __spreadProps(__spreadValues({}, props), {
            items: result.items,
            loading: false
          }) : __spreadProps(__spreadValues({}, props), {
            loading: false
          });
        }
      }
      if (currentState === "stopped") {
        asyncRequest.abort();
        dispatchStateUpdate(currentState, props);
        props = void 0;
        return;
      }
      if (currentState === "updated") {
        dispatchStateUpdate(currentState, props);
      }
    },
    destroy: () => {
      var _a;
      asyncRequest.abort();
      if (!props) {
        return;
      }
      (_a = renderer == null ? void 0 : renderer.onExit) == null ? void 0 : _a.call(renderer, props);
    }
  };
}
var SuggestionPluginKey = new PluginKey("suggestion");
function Suggestion({
  pluginKey = SuggestionPluginKey,
  editor,
  char = "@",
  allowSpaces = false,
  allowToIncludeChar = false,
  allowedPrefixes = [" "],
  startOfLine = false,
  decorationTag = "span",
  decorationClass = "suggestion",
  decorationContent = "",
  decorationEmptyClass = "is-empty",
  command = () => null,
  items = () => [],
  minQueryLength = 0,
  debounce = 0,
  initialItems,
  placement = "bottom-start",
  offset: offsetOption = {},
  container,
  flip: flip3 = true,
  floatingUi,
  dismissOnOutsideClick = true,
  render = () => ({}),
  allow = () => true,
  findSuggestionMatch: findSuggestionMatch2 = findSuggestionMatch,
  shouldShow,
  shouldResetDismissed
}) {
  const renderer = render == null ? void 0 : render();
  const effectiveAllowSpaces = allowSpaces && !allowToIncludeChar;
  const clientRectFor2 = (view, decorationNode) => clientRectFor(editor, view, decorationNode, pluginKey);
  function shouldKeepDismissed2(props) {
    return shouldKeepDismissed(__spreadProps(__spreadValues({}, props), {
      editor,
      shouldResetDismissed,
      effectiveAllowSpaces
    }));
  }
  const dispatchExit2 = (view) => dispatchExit({
    view,
    pluginKeyRef: pluginKey
  });
  return new Plugin({
    key: pluginKey,
    view: () => createSuggestionView({
      editor,
      pluginKey,
      items,
      renderer,
      minQueryLength,
      debounce,
      initialItems,
      placement,
      offset: offsetOption,
      container,
      flip: flip3,
      floatingUi,
      dismissOnOutsideClick,
      command,
      clientRectFor: clientRectFor2,
      dispatchExit: dispatchExit2
    }),
    state: createSuggestionState({
      editor,
      char,
      effectiveAllowSpaces,
      allowToIncludeChar,
      allowedPrefixes,
      startOfLine,
      findSuggestionMatch: findSuggestionMatch2,
      allow,
      shouldShow,
      shouldKeepDismissed: shouldKeepDismissed2,
      pluginKey
    }),
    props: createSuggestionProps({
      pluginKey,
      decorationTag,
      decorationClass,
      decorationContent,
      decorationEmptyClass,
      renderer,
      dispatchExit: dispatchExit2
    })
  });
}

// node_modules/@tiptap/extension-mention/dist/index.js
function getSuggestionOptions({
  editor: tiptapEditor,
  overrideSuggestionOptions,
  extensionName,
  char = "@"
}) {
  const pluginKey = new PluginKey();
  return __spreadValues({
    editor: tiptapEditor,
    char,
    pluginKey,
    command: ({ editor, range, props }) => {
      var _a, _b, _c;
      const nodeAfter = editor.view.state.selection.$to.nodeAfter;
      const overrideSpace = (_a = nodeAfter == null ? void 0 : nodeAfter.text) == null ? void 0 : _a.startsWith(" ");
      if (overrideSpace) {
        range.to += 1;
      }
      editor.chain().focus().insertContentAt(range, [
        {
          type: extensionName,
          attrs: __spreadProps(__spreadValues({}, props), { mentionSuggestionChar: char })
        },
        {
          type: "text",
          text: " "
        }
      ]).run();
      (_c = (_b = editor.view.dom.ownerDocument.defaultView) == null ? void 0 : _b.getSelection()) == null ? void 0 : _c.collapseToEnd();
    },
    allow: ({ state, range }) => {
      const $from = state.doc.resolve(range.from);
      const type = state.schema.nodes[extensionName];
      const allow = !!$from.parent.type.contentMatch.matchType(type);
      return allow;
    }
  }, overrideSuggestionOptions);
}
function getSuggestions(options) {
  return (options.options.suggestions.length ? options.options.suggestions : [options.options.suggestion]).map(
    (suggestion) => getSuggestionOptions({
      // @ts-ignore `editor` can be `undefined` when converting the document to HTML with the HTML utility
      editor: options.editor,
      overrideSuggestionOptions: suggestion,
      extensionName: options.name,
      char: suggestion.char
    })
  );
}
function getSuggestionFromChar(options, char) {
  const suggestions = getSuggestions(options);
  const suggestion = suggestions.find((s) => s.char === char);
  if (suggestion) {
    return suggestion;
  }
  if (suggestions.length) {
    return suggestions[0];
  }
  return null;
}
var Mention = Node3.create(__spreadProps(__spreadValues({
  name: "mention",
  priority: 101,
  addOptions() {
    return {
      HTMLAttributes: {},
      renderText({ node, suggestion }) {
        var _a, _b;
        return `${(_a = suggestion == null ? void 0 : suggestion.char) != null ? _a : "@"}${(_b = node.attrs.label) != null ? _b : node.attrs.id}`;
      },
      deleteTriggerWithBackspace: false,
      renderHTML({ options, node, suggestion }) {
        var _a, _b;
        return [
          "span",
          mergeAttributes(this.HTMLAttributes, options.HTMLAttributes),
          `${(_a = suggestion == null ? void 0 : suggestion.char) != null ? _a : "@"}${(_b = node.attrs.label) != null ? _b : node.attrs.id}`
        ];
      },
      suggestions: [],
      suggestion: {}
    };
  },
  group: "inline",
  inline: true,
  selectable: false,
  atom: true,
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }
          return {
            "data-id": attributes.id
          };
        }
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }
          return {
            "data-label": attributes.label
          };
        }
      },
      // When there are multiple types of mentions, this attribute helps distinguish them
      mentionSuggestionChar: {
        default: "@",
        parseHTML: (element) => element.getAttribute("data-mention-suggestion-char"),
        renderHTML: (attributes) => {
          return {
            "data-mention-suggestion-char": attributes.mentionSuggestionChar
          };
        }
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`
      }
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const suggestion = getSuggestionFromChar(this, node.attrs.mentionSuggestionChar);
    if (this.options.renderLabel !== void 0) {
      console.warn("renderLabel is deprecated use renderText and renderHTML instead");
      return [
        "span",
        mergeAttributes({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes),
        this.options.renderLabel({
          options: this.options,
          node,
          suggestion
        })
      ];
    }
    const mergedOptions = __spreadValues({}, this.options);
    mergedOptions.HTMLAttributes = mergeAttributes(
      { "data-type": this.name },
      this.options.HTMLAttributes,
      HTMLAttributes
    );
    const html = this.options.renderHTML({
      options: mergedOptions,
      node,
      suggestion
    });
    if (typeof html === "string") {
      return [
        "span",
        mergeAttributes({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes),
        html
      ];
    }
    return html;
  }
}, createInlineMarkdownSpec({
  nodeName: "mention",
  name: "@",
  selfClosing: true,
  allowedAttributes: ["id", "label", { name: "mentionSuggestionChar", skipIfDefault: "@" }],
  parseAttributes: (attrString) => {
    const attrs = {};
    const regex = /(\w+)=(?:"([^"]*)"|'([^']*)')/g;
    let match = regex.exec(attrString);
    while (match !== null) {
      const [, key, doubleQuoted, singleQuoted] = match;
      const value = doubleQuoted != null ? doubleQuoted : singleQuoted;
      attrs[key === "char" ? "mentionSuggestionChar" : key] = value;
      match = regex.exec(attrString);
    }
    return attrs;
  },
  serializeAttributes: (attrs) => {
    return Object.entries(attrs).filter(([, value]) => value !== void 0 && value !== null).map(([key, value]) => {
      const serializedKey = key === "mentionSuggestionChar" ? "char" : key;
      return `${serializedKey}="${value}"`;
    }).join(" ");
  }
})), {
  renderText({ node }) {
    const args = {
      options: this.options,
      node,
      suggestion: getSuggestionFromChar(this, node.attrs.mentionSuggestionChar)
    };
    if (this.options.renderLabel !== void 0) {
      console.warn("renderLabel is deprecated use renderText and renderHTML instead");
      return this.options.renderLabel(args);
    }
    return this.options.renderText(args);
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () => this.editor.commands.command(({ tr, state }) => {
        let isMention = false;
        const { selection } = state;
        const { empty, anchor } = selection;
        if (!empty) {
          return false;
        }
        let mentionNode = new Node2();
        let mentionPos = 0;
        state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
          if (node.type.name === this.name) {
            isMention = true;
            mentionNode = node;
            mentionPos = pos;
            return false;
          }
        });
        if (isMention) {
          tr.insertText(
            this.options.deleteTriggerWithBackspace ? "" : mentionNode.attrs.mentionSuggestionChar,
            mentionPos,
            mentionPos + mentionNode.nodeSize
          );
        }
        return isMention;
      })
    };
  },
  addProseMirrorPlugins() {
    return getSuggestions(this).map(Suggestion);
  }
}));
var index_default = Mention;
export {
  Mention,
  index_default as default
};
//# sourceMappingURL=@tiptap_extension-mention.js.map
