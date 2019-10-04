export function animate(
    el: Element,
    effect: string,
    callback?: () => void,
) {
    el.addEventListener('animationend', onAnimationEnd, false);
    function onAnimationEnd() {
        el.classList.remove('animated', 'faster', effect);
        el.removeEventListener('animationend', onAnimationEnd, false);
        if (callback) {
            callback();
        }
    }
    el.classList.add('animated', 'faster', effect);
}
