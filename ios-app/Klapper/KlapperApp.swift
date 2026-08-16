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
            guard nieuw == .active, voorraad.aangemeld else { return }
            Task { await voorraad.synchroniseer() }
        }
    }
}
