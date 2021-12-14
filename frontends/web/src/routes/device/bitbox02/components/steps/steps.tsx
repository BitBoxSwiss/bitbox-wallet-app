import { cloneElement, Component } from 'react';
import * as style from './steps.module.css';

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

    public UNSAFE_componentWillReceiveProps(nextProps) {
        const step = this.getActiveStep(nextProps.children);
        if (this.state.activeStep !== step) {
            this.setState({ activeStep: step });
        }
    }

    private getActiveStep = (children: JSX.Element[]) => {
        return children.filter(child => child).findIndex(child => child.props.active) + 1;
    }

    public render() {
        const { children } = this.props;
        const { activeStep } = this.state;
        return (
            <div className={style.steps}>
                {(children as JSX.Element[]).filter(child => child).map((child, i) => cloneElement(child, { order: i + 1, activeStep }))}
            </div>
        );
    }
}

export { Steps };
