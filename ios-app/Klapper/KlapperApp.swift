import SwiftUI

@main
struct KlapperApp: App {
    @State private var voorraad = Voorraad()

    var body: some Scene {
        WindowGroup {
            Ingang()
                .environment(voorraad)
                .task {
                    Stijl.controleerFonts()
                    // Wekkers die de app overleefd hebben terugpakken, vóór
                    // het synchroniseren: zonder dit heb je er geen greep meer
                    // op en blijven ze op het vergrendelscherm staan.
                    Kookwekker.gedeeld.hervatBestaande()
                    await voorraad.begin()
                }
        }
    }
}

/// Aangemeld of niet — meer keuze is er bij het opstarten niet.
private struct Ingang: View {
    @Environment(Voorraad.self) private var voorraad
    @Environment(\.scenePhase) private var fase

    var body: some View {
        Group {
            if voorraad.aangemeld {
                OverzichtScherm()
            } else {
                AanmeldScherm()
            }
        }
        // Terug uit je zak: even kijken of er iets nieuws is. De kast staat er
        // al, dus dit mag mislukken zonder dat je iets merkt.
        .onChange(of: fase) { _, nieuw in
            guard nieuw == .active else { return }
            // Ook hier de wekkers nalopen: een afgegane wekker die niemand
            // wegdrukte hoort weg te zijn tegen de tijd dat je terugkomt.
            Kookwekker.gedeeld.hervatBestaande()
            guard voorraad.aangemeld else { return }
            Task { await voorraad.synchroniseer() }
        }
    }
}
