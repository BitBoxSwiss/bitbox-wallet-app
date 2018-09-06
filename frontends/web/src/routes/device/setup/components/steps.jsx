import { h, Component, cloneElement } from 'preact';
import finishIcon from '../../../../assets/icons/ok.svg';
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
            {
                children.map((child, index) => {
                    if (!child) return null;
                    if (child.attributes.divider) {
                        return (
                            <div className={style.divider}>»</div>
                        );
                    } else {
                        const step = Math.ceil(index / 2);
                        const status = step === current ? STATUS.PROCESS : (
                            step < current ? STATUS.FINISH : STATUS.WAIT
                        );
                        return cloneElement(child, {
                            step: `${step + 1}`,
                            // step: step,
                            status,
                            ...child.props,
                        });
                    }
                })
            }
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
        <div className={[style.step, style[status]].join(' ')} {...props}>
            <div className={style.stepIcon}>
                {
                    icon || (status === STATUS.FINISH ? (
                        <img src={finishIcon} />
                    ) : (
                        <span>{step}</span>
                    ))
                }
            </div>
            <p className={style.stepContent}>
                {
                    title && (
                        <span className={style.title}>{title}</span>
                    )
                }

                {
                    description && (
                        <span className={style.description}>{description}</span>
                    )
                }
            </p>
        </div>
    );
}
