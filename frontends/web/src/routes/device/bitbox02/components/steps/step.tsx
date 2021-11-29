import { Component, h, RenderableProps } from 'preact';
import * as style from './steps.module.css';

interface StepProps {
  active: boolean;
  title?: string;
  order?: number;
  activeStep?: number;
  empty?: boolean;
  large?: boolean;
  width?: number;
}

interface State {
  isComplete: boolean;
  visible: boolean;
}

class Step extends Component<StepProps, State> {
    constructor(props) {
        super(props);
        this.state = {
            isComplete: this.isComplete(),
            visible: this.isVisible(),
        };
    }

    public componentWillReceiveProps(nextProps) {
        const { empty, order, activeStep } = nextProps;
        this.setState({
            isComplete: empty || order < activeStep,
            visible: (empty && activeStep === 1) || [activeStep! - 1, activeStep, activeStep! + 1].includes(order),
        });
    }

    private isComplete = () => {
        const { empty, activeStep, order } = this.props;
        return empty || order! < activeStep!;
    }

    private isVisible = () => {
        return [this.props.activeStep].includes(this.props.order);
    }

    public render(
        { active, empty, title, large, width, children }: RenderableProps<StepProps>,
        { isComplete, visible }: State,
    ) {
        return (
            <div
                className={[
                    style.step, active ? style.active : '',
                    empty ? style.empty : '',
                    isComplete ? style.complete : '',
                    visible ? '' : style.hide,
                    large ? style.large : '',
                ].join(' ')}
                style={width ? `max-width: ${width}px` : ''}
                >
                <div className={style.stepContentContainer}>
                    <div className={style.stepContent}>
                        <div className={style.stepTitle}>
                            <h3>{title}</h3>
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}

export { Step };
