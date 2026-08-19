import Foundation
import Observation
import UniformTypeIdentifiers

/// De toestand van het deelscherm: wat er binnenkwam, wie het deelt, en hoe
/// het versturen gaat.
///
/// Geen `Klant` als gedeelde singleton — de extensie maakt zijn eigen, met
/// dezelfde `Sleutelbos`. Dat is dezelfde `actor`-klasse als in de app, alleen
/// een ander proces: extensies draaien apart van de host-app, ook al delen ze
/// de Keychain en de App Group.
@Observable
@MainActor
final class DeelModel {
    enum Status: Equatable {
        case concept
        case bezig
        case klaar
        case fout(String)
    }

    private(set) var gedeeldeUrl: URL?
    private(set) var gedeeldeTekst: String?
    private(set) var namen: [String] = []
    private(set) var nietAangemeld = false
    private(set) var status: Status = .concept
    var wie: String = ""

    private let sleutelbos = Sleutelbos.standaard
    private let kast = Kast()

    var voorbeeld: String? {
        gedeeldeUrl?.absoluteString ?? gedeeldeTekst
    }

    var kanBewaren: Bool {
        (gedeeldeUrl != nil || gedeeldeTekst != nil) && !nietAangemeld && status != .bezig
    }

    /// Haalt de gedeelde link of tekst uit het systeem, en de huisgenoten uit
    /// de lokale kopie — geen netwerkaanroep nodig, `Kast` staat al gevuld
    /// door de app.
    func begin(met context: NSExtensionContext?) {
        wie = sleutelbos.ik ?? ""
        nietAangemeld = sleutelbos.token == nil || sleutelbos.serveradres == nil

        Task {
            await kast.laad()
            let instellingen = await kast.huidigeInstellingen()
            namen = instellingen.personen
            if wie.isEmpty { wie = namen.first ?? "" }
        }

        let items = (context?.inputItems as? [NSExtensionItem]) ?? []
        let bijlagen = items.flatMap { $0.attachments ?? [] }

        let url = UTType.url.identifier
        let tekst = UTType.plainText.identifier

        // Een link heeft de voorkeur boven tekst: biedt een app allebei aan,
        // dan kan de server bij een link zelf het recept ophalen.
        if let bijlage = bijlagen.first(where: { $0.hasItemConformingToTypeIdentifier(url) }) {
            bijlage.loadItem(forTypeIdentifier: url, options: nil) { [weak self] waarde, _ in
                let gevonden = (waarde as? URL) ?? (waarde as? String).flatMap(URL.init(string:))
                Task { @MainActor in self?.gedeeldeUrl = gevonden }
            }
            return
        }

        if let bijlage = bijlagen.first(where: { $0.hasItemConformingToTypeIdentifier(tekst) }) {
            bijlage.loadItem(forTypeIdentifier: tekst, options: nil) { [weak self] waarde, _ in
                let gevonden = waarde as? String
                Task { @MainActor in self?.gedeeldeTekst = gevonden }
            }
        }
    }

    /// Geeft `true` terug als het gelukt is — de aanroeper sluit het venster
    /// dan zelf, na een kort moment om het vinkje te laten zien.
    func bewaar() async -> Bool {
        guard gedeeldeUrl != nil || gedeeldeTekst != nil else { return false }
        status = .bezig
        sleutelbos.ik = wie.isEmpty ? nil : wie

        do {
            let klant = Klant(sleutelbos: sleutelbos)
            _ = try await klant.deel(
                url: gedeeldeUrl?.absoluteString,
                tekst: gedeeldeTekst,
                door: wie.isEmpty ? nil : wie
            )
            status = .klaar
            return true
        } catch {
            let melding = (error as? LocalizedError)?.errorDescription ?? "Niet gelukt."
            status = .fout(melding)
            return false
        }
    }
}
