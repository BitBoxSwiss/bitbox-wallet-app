// SPDX-License-Identifier: Apache-2.0

#include "macoswindow.h"

#include <AppKit/AppKit.h>
#include <QEvent>
#include <QTimer>
#include <QWebEnginePage>
#include <QWebEngineScript>
#include <QWebEngineScriptCollection>
#include <QWebEngineView>
#include <QtMath>

@interface BitBoxTitlebarView : NSView
@end

@implementation BitBoxTitlebarView
- (BOOL)acceptsFirstMouse:(NSEvent*)event {
    return YES;
}

- (void)mouseDown:(NSEvent*)event {
    if (event.clickCount != 2) {
        [self.window performWindowDragWithEvent:event];
    }
}

- (void)mouseUp:(NSEvent*)event {
    if (event.clickCount != 2) {
        return;
    }
    NSString* action = [NSUserDefaults.standardUserDefaults stringForKey:@"AppleActionOnDoubleClick"];
    SEL fillAction = NSSelectorFromString(@"_zoomFill:");
    if ([action isEqualToString:@"Fill"] && [self.window respondsToSelector:fillAction]) {
        // AppKit has no public Fill API.
        [self.window performSelector:fillAction withObject:nil];
    } else if (!action || [action isEqualToString:@"Maximize"] || [action isEqualToString:@"Fill"]) {
        [self.window performZoom:self];
    } else if ([action isEqualToString:@"Minimize"]) {
        [self.window performMiniaturize:self];
    }
}
@end

namespace {

class MacOSWindow : public QObject {
public:
    explicit MacOSWindow(QWebEngineView* view) : QObject(view), view(view) {
        view->setAttribute(Qt::WA_ContentsMarginsRespectsSafeArea, false);
        @autoreleasepool {
            NSWindow* window = nativeView().window;
            window.styleMask |= NSWindowStyleMaskFullSizeContentView;
            window.titlebarAppearsTransparent = YES;
            window.titleVisibility = NSWindowTitleHidden;
            if (@available(macOS 11.0, *)) {
                window.titlebarSeparatorStyle = NSTitlebarSeparatorStyleNone;
            }
            dragArea = [[BitBoxTitlebarView alloc] initWithFrame:NSZeroRect];
            [window.contentView.superview addSubview:dragArea
                positioned:NSWindowAbove relativeTo:window.contentView];
            resizeObserver = [NSNotificationCenter.defaultCenter
                addObserverForName:NSWindowDidResizeNotification object:window queue:nil
                usingBlock:^(NSNotification*) { updateInsets(); }];
        }
        view->installEventFilter(this);
        insetsScript.setName("macos-window-insets");
        insetsScript.setInjectionPoint(QWebEngineScript::DocumentReady);
        insetsScript.setWorldId(QWebEngineScript::ApplicationWorld);
        insetsScript.setRunsOnSubFrames(false);
        updateInsets();
    }

    ~MacOSWindow() override {
        [NSNotificationCenter.defaultCenter removeObserver:resizeObserver];
        [dragArea removeFromSuperview];
        [dragArea release];
    }

protected:
    bool eventFilter(QObject* object, QEvent* event) override {
        if (event->type() == QEvent::WindowStateChange) {
            // Safe-area insets settle after the window event.
            QTimer::singleShot(0, this, [this]() { updateInsets(); });
        }
        return QObject::eventFilter(object, event);
    }

private:
    NSView* nativeView() const {
        return reinterpret_cast<NSView*>(view->winId());
    }

    void updateInsets() {
        @autoreleasepool {
            NSView* contentView = nativeView();
            NSWindow* window = contentView.window;
            NSView* frameView = window.contentView.superview;
            [frameView layoutSubtreeIfNeeded];
            int height = qCeil(contentView.safeAreaInsets.top);
            if (height > 0 && !(window.styleMask & NSWindowStyleMaskFullScreen)) {
                NSButton* closeButton = [window standardWindowButton:NSWindowCloseButton];
                const CGFloat padding = 20.0;
                NSView* titlebarContainer = closeButton.superview.superview;
                NSRect titlebarFrame = titlebarContainer.frame;
                const CGFloat extraHeight = qMax(0.0, padding + NSHeight(closeButton.frame) - NSHeight(titlebarFrame));
                if (!frameView.isFlipped) {
                    titlebarFrame.origin.y -= extraHeight;
                }
                titlebarFrame.size.height += extraHeight;
                titlebarContainer.frame = titlebarFrame;
                height = qMax(height, qCeil(NSHeight(titlebarFrame)));
                const NSRect closeFrame = [frameView convertRect:closeButton.bounds fromView:closeButton];
                const CGFloat offsetX = padding - NSMinX(closeFrame);
                const CGFloat offsetY = frameView.isFlipped ? padding - NSMinY(closeFrame)
                    : NSMaxY(frameView.bounds) - padding - NSMaxY(closeFrame);
                for (NSWindowButton type : {NSWindowCloseButton, NSWindowMiniaturizeButton, NSWindowZoomButton}) {
                    NSButton* button = [window standardWindowButton:type];
                    NSRect frame = [frameView convertRect:button.bounds fromView:button];
                    frame.origin.x += offsetX;
                    frame.origin.y += offsetY;
                    button.frame = [button.superview convertRect:frame fromView:frameView];
                }
            }
            NSButton* zoomButton = [window standardWindowButton:NSWindowZoomButton];
            const CGFloat left = NSMaxX([frameView convertRect:zoomButton.bounds fromView:zoomButton]) + 8;
            const NSRect bounds = contentView.bounds;
            NSRect rect = [frameView convertRect:NSMakeRect(
                NSMinX(bounds), contentView.isFlipped ? NSMinY(bounds) : NSMaxY(bounds) - height,
                NSWidth(bounds), height) fromView:contentView];
            rect.size.width -= left - rect.origin.x;
            rect.origin.x = left;
            dragArea.frame = rect;
            dragArea.hidden = height == 0;
            if (height == titlebarHeight) {
                return;
            }
            titlebarHeight = height;
            const QString source = QString(
                "if (document.documentElement) {"
                "document.documentElement.style.setProperty('--window-titlebar-height', '%1px');"
                "}"
            ).arg(height);

            QWebEngineScriptCollection& scripts = view->page()->scripts();
            scripts.remove(insetsScript);
            insetsScript.setSourceCode(source);
            scripts.insert(insetsScript);
            view->page()->runJavaScript(source, QWebEngineScript::ApplicationWorld);
        }
    }

    QWebEngineView* view;
    NSView* dragArea;
    id resizeObserver;
    QWebEngineScript insetsScript;
    int titlebarHeight = -1;
};

}

void setupMacOSWindow(QWebEngineView* view) {
    new MacOSWindow(view);
}
