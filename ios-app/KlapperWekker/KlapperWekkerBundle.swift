import SwiftUI
import WidgetKit

/// Het startpunt van de widget-extensie.
///
/// Hier mag `@main` wél staan, in tegenstelling tot bij `KlapperDelen`. Een
/// widget-extensie start via een `WidgetBundle` en niet via
/// `NSExtensionPrincipalClass`; dat verschil is precies waarom
/// `npm run swift:targets` per extensie weet welk startpunt hoort.
@main
struct KlapperWekkerBundle: WidgetBundle {
    var body: some Widget {
        KookwekkerLiveActivity()
    }
}
