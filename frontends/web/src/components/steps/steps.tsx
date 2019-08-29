import { cloneElement, Component, h, RenderableProps } from 'preact';
import * as style from './steps.css';

interface State {
    activeStep: number;
}

class Steps extends Component<{}, State> {
    constructor(props) {
        super(props);
        this.state = {
            activeStep: this.getActiveStep(props.children),
        };
    }

    public componentWillReceiveProps(nextProps) {
        const step = this.getActiveStep(nextProps.children);
        if (this.state.activeStep !== step) {
            this.setState({ activeStep: step });
        }
    }

    private getActiveStep = (children: JSX.Element[]) => {
        return children.filter(child => child).findIndex(child => child.attributes.active) + 1;
    }

    public render(
        { children }: RenderableProps<{}>,
        { activeStep }: State,
    ) {
        return (
            <div className={style.steps}>
                {(children as JSX.Element[]).filter(child => child).map((child, i) => cloneElement(child, { order: i + 1, activeStep }))}
            </div>
        );
    }
}

export { Steps };
