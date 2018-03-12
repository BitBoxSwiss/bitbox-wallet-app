import createFocusTrap from 'focus-trap';

import MDCDialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';


export default class WaitDialog extends MDCDialog {
    componentDidMount() {
        super.componentDidMount.apply(this);
        // Prevent canceling the dialog by ESC or clicking the backdrop.
        this.MDComponent.foundation_.cancel = () => {};
        // Usually, the accept button gets focus, but we don't have
        // one, so use the whole dialog as the focus element.
        this.MDComponent.focusTrap_ = createFocusTrap(this.MDComponent.dialogSurface_, {
            initialFocus: this.MDComponent.dialogSurface_
        });
    }
}
