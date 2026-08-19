import SwiftUI
import UIKit

/// De hoofdklasse van de deelextensie — staat als `NSExtensionPrincipalClass`
/// in de Info.plist van het `KlapperDelen`-target, in plaats van het
/// standaard-storyboard dat Xcode neerzet. Bouwt zelf zijn scherm op met
/// `DeelScherm`, dezelfde SwiftUI als de rest van de app.
final class DeelExtensieController: UIViewController {
    private let model = DeelModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        let scherm = DeelScherm(
            model: model,
            annuleer: { [weak self] in self?.annuleer() },
            klaar: { [weak self] in self?.klaar() }
        )
        let host = UIHostingController(rootView: scherm)
        host.view.backgroundColor = .clear

        addChild(host)
        view.addSubview(host.view)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        host.didMove(toParent: self)

        model.begin(met: extensionContext)
    }

    private func annuleer() {
        extensionContext?.cancelRequest(withError: NSError(domain: "nl.klapper.delen", code: 0))
    }

    private func klaar() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
