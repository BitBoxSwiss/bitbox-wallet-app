import { h, cloneElement } from 'preact';
import style from './steps.css';

const STATUS = Object.freeze({
    PROCESS: 'process',
    FINISH: 'finish',
    WAIT: 'wait',
});

export function Steps({
    current,
    children
}) {
    return (
        <div className={style.steps}>
            {children.map((child, index) => {
                if (!child) {
                    return null;
                }
                const status = index === current ? STATUS.PROCESS: (
                    index < current ? STATUS.FINISH : STATUS.WAIT
                );
                return cloneElement(child, {
                    step: `${index + 1}`,
                    status,
                    ...child.props,
                });
            })}
        </div>
    );
}

export function Step({
    status,
    step,
    title,
    icon,
    description,
    ...props
}) {
    return (
        <div
            className={[style.step, style[status]].join(' ')}
            {...props} >

            <div className={style.stepIcon}>
                <span>{icon || (status === STATUS.FINISH ? '✓' : step)}</span>
            </div>

            <div className={style.stepContent}>
                <div className={style.stepTitle}>
                    { title && (
                        <span className={style.padding}>{title}</span>
                    )}
                </div>
                <div className={style.stepDescription}>
                    { description && (
                        <span className={style.padding}>{description}</span>
                    )}
                </div>
            </div>

        </div>
    );
}
