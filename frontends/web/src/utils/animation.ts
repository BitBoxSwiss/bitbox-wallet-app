import { debug } from './env';

const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = mq.matches;
try {
    // experimental https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList
    // @ts-ignore
    mq.addListener(e => reduceMotion = e.matches);
} catch (e) {
    if (debug) {
        /* eslint no-console: "off" */
        console.log(e);
    }
}

export function animate(
    el: Element,
    effect: string,
    callback?: () => void,
) {
    if (reduceMotion) {
        if (callback) {
            callback();
        }
        return;
    }
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
