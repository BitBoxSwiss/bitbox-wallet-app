export function animate(
    el: Element,
    effect: string,
    shouldHide?: boolean,
    callback?: () => void,
) {
    el.addEventListener('animationend', onAnimationEnd.bind(el, effect, shouldHide, callback), false);
    function onAnimationEnd() {
      el.classList.remove('animated', 'faster', effect);
      if (callback) {
        callback();
      }
    }
    el.classList.add('animated', 'faster', effect);
}
