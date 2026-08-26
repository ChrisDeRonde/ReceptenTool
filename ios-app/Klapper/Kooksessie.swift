import AudioToolbox
import Foundation
import Observation
import UIKit

/// Eén keer koken, van stap één tot en met eet smakelijk.
///
/// Alles wat er tijdens het koken verandert staat hier en niet in de view: waar
/// je bent, welke pannen lopen, en wat je al gepakt hebt. Dat is niet alleen
/// netter — het is de enige manier waarop de wekkers blijven lopen terwijl je
/// door de stappen bladert, want een `@State` in een view die opnieuw wordt
/// opgebouwd is die wekkers kwijt.
///
/// Dezelfde regels als de kookmodus op het web (`src/components/CookMode.tsx`),
/// met één ding erbij dat de browser niet kan: elke lopende wekker staat ook op
/// het vergrendelscherm, via `Kookwekker`. Koken is niet naar je telefoon
/// kijken.
@Observable
@MainActor
final class Kooksessie {
    /// Eén wekker bij één stap.
    struct Wekker {
        /// Wanneer hij afgaat, als hij loopt. `nil` betekent: staat stil.
        var eindigtOp: Date?
        /// Wat er nog staat. Leidend zodra hij stilstaat.
        var rest: Int
        /// Afgegaan en nog niet weggeklikt.
        var af: Bool

        var loopt: Bool { eindigtOp != nil }
    }

    let recept: Recept
    /// Voor hoeveel personen. Alleen om de hoeveelheden mee om te rekenen.
    let porties: Int?

    private(set) var huidige = 0
    private(set) var wekkers: [Int: Wekker] = [:]
    /// De klok waar de aftellingen op meelopen. Eén bron voor alle wekkers
    /// samen, net als op het web.
    private(set) var nu = Date()
    /// Wat er al in de pan ligt, op sleutel `stap:regel`.
    var gepakt: Set<String> = []
    /// Welke kant je op ging. Alleen om de nieuwe stap van de goede kant in te
    /// laten schuiven.
    private(set) var vooruit = true

    private var tik: Task<Void, Never>?

    init(recept: Recept, porties: Int?) {
        self.recept = recept
        self.porties = porties
    }

    // MARK: - Waar je bent

    var stap: Stap? {
        recept.stappen.indices.contains(huidige) ? recept.stappen[huidige] : nil
    }

    var volgende: Stap? {
        let na = huidige + 1
        return recept.stappen.indices.contains(na) ? recept.stappen[na] : nil
    }

    var isLaatste: Bool { huidige >= recept.stappen.count - 1 }

    func ga(naar doel: Int) {
        let begrensd = max(0, min(recept.stappen.count - 1, doel))
        guard begrensd != huidige else { return }
        vooruit = begrensd > huidige
        huidige = begrensd
    }

    // MARK: - De wekkers

    /// Starten, of verder tellen vanaf waar hij stilstond.
    func start(_ index: Int, minuten: Int) {
        guard minuten > 0 else { return }
        let bestaand = wekkers[index]
        let hervatten = bestaand != nil && !(bestaand?.af ?? false) && (bestaand?.rest ?? 0) > 0
        let seconden = hervatten ? (bestaand?.rest ?? 0) : minuten * 60

        wekkers[index] = Wekker(
            eindigtOp: Date().addingTimeInterval(TimeInterval(seconden)),
            rest: seconden,
            af: false
        )

        if hervatten {
            Kookwekker.gedeeld.hervat(receptId: recept.id, stap: index + 1)
        } else {
            Kookwekker.gedeeld.start(
                gerecht: recept.titel,
                receptId: recept.id,
                stap: index + 1,
                vanTotaal: recept.stappen.count,
                stapTitel: kort(recept.stappen[index]),
                minuten: minuten
            )
        }

        nu = Date()
        begintTikken()
    }

    func pauzeer(_ index: Int) {
        guard let wekker = wekkers[index], let eind = wekker.eindigtOp else { return }
        wekkers[index] = Wekker(
            eindigtOp: nil,
            rest: max(0, Int(eind.timeIntervalSinceNow.rounded())),
            af: false
        )
        Kookwekker.gedeeld.pauzeer(receptId: recept.id, stap: index + 1)
    }

    func wis(_ index: Int) {
        wekkers[index] = nil
        Kookwekker.gedeeld.stop(receptId: recept.id, stap: index + 1)
    }

    /// Wat er nog staat, in seconden. Loopt hij, dan geteld vanaf `nu`.
    func resterend(_ index: Int) -> Int {
        guard let wekker = wekkers[index] else { return 0 }
        guard let eind = wekker.eindigtOp else { return wekker.rest }
        return max(0, Int(eind.timeIntervalSince(nu).rounded()))
    }

    /// Een wekker die ergens anders loopt, met de stap eraan vast.
    ///
    /// Een eigen type en geen tupel: `ForEach` wil een sleutelpad, en naar een
    /// veld van een tupel bestaat er geen.
    struct Elders: Identifiable {
        let stap: Int
        let wekker: Wekker

        var id: Int { stap }
    }

    /// Wekkers van ándere stappen die nog lopen of net afgingen. Die verdienen
    /// een knopje bovenin, want anders vergeet je de pan waar je niet bij staat.
    var elders: [Elders] {
        wekkers
            .filter { $0.key != huidige && ($0.value.loopt || $0.value.af) }
            .sorted { $0.key < $1.key }
            .map { Elders(stap: $0.key, wekker: $0.value) }
    }

    /// Welke stappen er afgegaan zijn. Voor de regel die VoiceOver voorleest.
    var afgegaan: [Int] {
        wekkers.filter(\.value.af).keys.sorted().map { $0 + 1 }
    }

    private var erLooptIets: Bool {
        wekkers.values.contains(where: \.loopt)
    }

    // MARK: - Opruimen

    /// De kookmodus verlaten. Pannen van het vuur, wekkers van het slot.
    func stop() {
        tik?.cancel()
        tik = nil
        wekkers.removeAll()
        Kookwekker.gedeeld.stopAlles(van: recept.id)
        UIApplication.shared.isIdleTimerDisabled = false
    }

    /// Het scherm aanhouden zolang je kookt. Handen vol, telefoon op het
    /// aanrecht — een scherm dat na dertig seconden op zwart gaat is precies
    /// het verkeerde moment om je vinger af te vegen.
    func houdSchermAan() {
        UIApplication.shared.isIdleTimerDisabled = true
    }

    // MARK: - Binnenwerk

    /// Eén lus voor alle wekkers samen, en alleen zolang er iets loopt.
    ///
    /// Vier keer per seconde: genoeg om de seconden gelijk over te laten
    /// springen met wat er op het vergrendelscherm staat, weinig genoeg om
    /// niets te merken aan de batterij.
    private func begintTikken() {
        guard tik == nil else { return }
        tik = Task { @MainActor [weak self] in
            while let sessie = self, !Task.isCancelled, sessie.erLooptIets {
                sessie.nu = Date()
                sessie.kijkOfErIetsAfgaat()
                try? await Task.sleep(for: .milliseconds(250))
            }
            self?.tik = nil
        }
    }

    private func kijkOfErIetsAfgaat() {
        let klaar = wekkers
            .filter { $0.value.loopt && ($0.value.eindigtOp ?? .distantFuture) <= nu }
            .keys
            .sorted()
        guard !klaar.isEmpty else { return }

        for index in klaar {
            wekkers[index] = Wekker(eindigtOp: nil, rest: 0, af: true)
        }
        laatAfgaan()
    }

    /// Piepen en trillen.
    ///
    /// `AudioServicesPlayAlertSound` volgt het belknopje aan de zijkant. Dat is
    /// een keuze: een keukentimer die door de stille stand heen gilt terwijl de
    /// kleine slaapt is erger dan een gemiste piep. Wie de app niet in beeld
    /// heeft ziet het op het vergrendelscherm — dáár is de Live Activity voor,
    /// niet dit geluidje.
    private func laatAfgaan() {
        AudioServicesPlayAlertSound(SystemSoundID(1005))
        UINotificationFeedbackGenerator().notificationOccurred(.warning)

        // Wie het scherm niet ziet en het piepje niet hoort, hoort het zo.
        // Een aankondiging en geen label op een verstopt tekstje: dit mag
        // onderbreken waar VoiceOver mee bezig was.
        let af = afgegaan
        guard !af.isEmpty else { return }
        let welke = af.count == 1
            ? "stap \(af[0])"
            : "stap " + af.dropLast().map(String.init).joined(separator: ", ")
                + " en \(af.last ?? 0)"
        UIAccessibility.post(notification: .announcement, argument: "De tijd voor \(welke) is om.")
    }

    /// De stap in het kort, voor op het vergrendelscherm.
    ///
    /// Liefst de titel; anders de eerste zin, en die kan nog steeds te lang
    /// zijn voor een Dynamic Island.
    private func kort(_ stap: Stap) -> String {
        if let titel = stap.titel, !titel.isEmpty { return titel }
        let eersteZin = stap.tekst.split(separator: ".", maxSplits: 1).first.map(String.init)
        let tekst = (eersteZin ?? stap.tekst).trimmingCharacters(in: .whitespacesAndNewlines)
        guard tekst.count > 40 else { return tekst }
        return tekst.prefix(39).trimmingCharacters(in: .whitespaces) + "…"
    }
}
