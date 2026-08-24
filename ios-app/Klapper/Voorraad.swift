import Foundation
import Observation

/// Wat de schermen zien.
///
/// De enige plek die de klant en de kast aan elkaar knoopt. De regel is
/// eenvoudig en de moeite waard om vast te houden: **de schermen lezen uit de
/// kast, nooit uit het net.** Synchroniseren vult de kast; mislukt dat, dan
/// staat er nog steeds wat er gisteren stond. Dat is precies wat je wilt in een
/// supermarkt zonder bereik.
@Observable
@MainActor
final class Voorraad {
    private(set) var recepten: [Recept] = []
    private(set) var instellingen: Instellingen = .leeg
    private(set) var bezig = false
    private(set) var laatsteFout: String?
    private(set) var aangemeld = false
    private(set) var openInInbox = 0

    private let klant: Klant
    private let kast: Kast
    private let sleutelbos: Sleutelbos

    init(
        klant: Klant = Klant(),
        kast: Kast = Kast(),
        sleutelbos: Sleutelbos = .standaard
    ) {
        self.klant = klant
        self.kast = kast
        self.sleutelbos = sleutelbos
    }

    /// De naam waarmee deze telefoon dingen ondertekent.
    ///
    /// Leest uit de gedeelde defaults en niet uit een eigen veld, zodat de
    /// deelextensie dezelfde naam ziet. Let op: `@Observable` volgt alleen
    /// opgeslagen eigenschappen, dus een scherm dat híérop moet reageren heeft
    /// een eigen `@State` nodig.
    var ik: String? {
        get { sleutelbos.ik }
        set { sleutelbos.ik = newValue }
    }

    /// Het volledige adres van een receptfoto.
    ///
    /// De server geeft een pad terug (`/api/foto/abc.jpg`) en niet een volledig
    /// adres, want op het web is dat genoeg. `URL(string:)` maakt daar een
    /// relatieve URL van zonder host, en `AsyncImage` laat dan stilletjes een
    /// leeg vlak zien. Dus hier plakken we het serveradres ervoor.
    ///
    /// Er hoeft geen token bij: de fotoroute valt buiten de poort van de
    /// middleware, omdat die alles met een plaatje-extensie doorlaat.
    func fotoURL(_ pad: String?) -> URL? {
        guard let pad, !pad.isEmpty else { return nil }
        if let volledig = URL(string: pad), volledig.host() != nil { return volledig }
        guard let basis = sleutelbos.serveradres else { return nil }
        return basis.appending(path: pad)
    }

    // MARK: - Opstarten

    /// Eerst tonen wat er is, dan pas kijken of er iets nieuws is.
    ///
    /// Die volgorde is het halve verschil tussen een app die snel voelt en een
    /// app die snel is: de kast staat er in een oogwenk, het net mag zijn tijd
    /// nemen.
    func begin() async {
        await kast.laad()
        recepten = await kast.alles()
        instellingen = await kast.huidigeInstellingen()
        aangemeld = await klant.isAangemeld
        guard aangemeld else { return }
        await synchroniseer()
    }

    func meldAan(adres: URL, wachtwoord: String) async -> Bool {
        bezig = true
        laatsteFout = nil
        defer { bezig = false }

        do {
            await klant.stelServerIn(adres)
            try await klant.meldAan(wachtwoord: wachtwoord)
            aangemeld = true
            // `haalOp()` en niet `synchroniseer()`: die laatste zet zelf de
            // `bezig`-vlag en keert meteen om als hij al aanstaat — wat hier zo
            // is. Eén eigenaar van de vlag per beurt, anders is de eerste
            // synchronisatie na het aanmelden een lege kast.
            await haalOp()
            return true
        } catch {
            laatsteFout = error.localizedDescription
            return false
        }
    }

    func meldAf() async {
        await klant.meldAf()
        aangemeld = false
    }

    // MARK: - Gelijktrekken

    func synchroniseer() async {
        guard !bezig else { return }
        bezig = true
        defer { bezig = false }
        await haalOp()
    }

    /// Het eigenlijke gelijktrekken, zonder de `bezig`-vlag aan te raken.
    ///
    /// Apart van `synchroniseer()` omdat het aanmelden er ook doorheen moet,
    /// en dat zet de vlag al zelf. Wie dit aanroept, is er verantwoordelijk
    /// voor dat er niet al een andere ronde loopt.
    private func haalOp() async {
        laatsteFout = nil

        do {
            let stand = try await klant.stand()
            let plan = Synchronisatie.plan(
                lokaal: await kast.stempels(),
                server: stand.recepten
            )

            if !plan.ophalen.isEmpty {
                let bundel = try await klant.recepten(ids: plan.ophalen)
                try await kast.bewaar(bundel.recepten)
            }
            if !plan.wegdoen.isEmpty {
                try await kast.verwijder(plan.wegdoen)
            }
            try await kast.bewaar(stand.instellingen)

            recepten = await kast.alles()
            instellingen = stand.instellingen
            openInInbox = stand.inbox.open
        } catch Klant.Fout.nietAangemeld {
            aangemeld = false
            laatsteFout = Klant.Fout.nietAangemeld.localizedDescription
        } catch {
            // Geen ramp: de kast staat er nog. De melding is er om te kunnen
            // zien dát het niet lukte, niet om de weg te versperren.
            laatsteFout = error.localizedDescription
        }
    }

    // MARK: - Doen

    /// Vastleggen dat je iets gemaakt hebt.
    ///
    /// Schrijft naar de server en haalt daarna dít ene recept opnieuw op, zodat
    /// het cijfer en de kooklog kloppen zonder de hele collectie langs te gaan.
    func noteerGemaakt(
        recept: Recept,
        sterren: Int?,
        notitie: String?,
        vaker: Bool?
    ) async -> Bool {
        do {
            try await klant.noteerGemaakt(
                receptId: recept.id,
                sterren: sterren,
                notitie: notitie?.isEmpty == false ? notitie : nil,
                vaker: vaker,
                wie: ik
            )
            let vers = try await klant.recept(id: recept.id)
            try await kast.bewaar([vers])
            recepten = await kast.alles()
            return true
        } catch {
            laatsteFout = error.localizedDescription
            return false
        }
    }
}
