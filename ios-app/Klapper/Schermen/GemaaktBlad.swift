import SwiftUI

/// Vastleggen dat je het gemaakt hebt.
///
/// Alles mag leeg blijven, net als op het web. Een formulier dat je dwingt een
/// oordeel te geven vul je na één keer niet meer in, en dan is de hele log
/// waardeloos; soms wil je alleen weten *dát* je het gemaakt hebt.
struct GemaaktBlad: View {
    @Environment(Voorraad.self) private var voorraad
    @Environment(\.dismiss) private var sluit
    let recept: Recept

    @State private var sterren: Int?
    @State private var notitie = ""
    @State private var vaker: Bool?
    @State private var bezig = false
    @State private var fout: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Wat vond je ervan?") {
                    HStack(spacing: 6) {
                        ForEach(1...5, id: \.self) { nummer in
                            Button {
                                // Nog een keer op dezelfde ster: weer geen
                                // oordeel. Anders zit je eraan vast zodra je
                                // er per ongeluk een aantikt.
                                sterren = (sterren == nummer) ? nil : nummer
                            } label: {
                                Image(systemName: (sterren ?? 0) >= nummer ? "star.fill" : "star")
                                    .font(.system(size: 22))
                                    .frame(width: Stijl.raakhoogte, height: Stijl.raakhoogte)
                                    .foregroundStyle(Kleur.ster)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(nummer) van 5 sterren")
                        }
                        Spacer()
                        if sterren != nil {
                            Button("Wissen") { sterren = nil }
                                .font(Letter.tekst(14))
                                .tint(Kleur.gedempt)
                        }
                    }
                }

                Section("Opmerking") {
                    TextField("Volgende keer minder zout", text: $notitie, axis: .vertical)
                        .lineLimit(1...4)
                }

                Section("Vaker eten?") {
                    Picker("Vaker eten?", selection: $vaker) {
                        Text("Weet niet").tag(Bool?.none)
                        Text("Ja").tag(Bool?.some(true))
                        Text("Nee").tag(Bool?.some(false))
                    }
                    .pickerStyle(.segmented)
                }

                if let fout {
                    Text(fout)
                        .font(Letter.tekst(14))
                        .foregroundStyle(Kleur.waarschuwing)
                }
            }
            .navigationTitle("Gemaakt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuleren") { sluit() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Bewaren") { Task { await bewaar() } }
                        .disabled(bezig)
                }
            }
        }
        .tint(Kleur.salie)
    }

    private func bewaar() async {
        bezig = true
        defer { bezig = false }

        let gelukt = await voorraad.noteerGemaakt(
            recept: recept,
            sterren: sterren,
            notitie: notitie.trimmingCharacters(in: .whitespacesAndNewlines),
            vaker: vaker
        )
        if gelukt {
            sluit()
        } else {
            // Blijven staan met wat je intikte. Dit sluiten en het weggooien
            // omdat de wifi even hikte is het ergste wat dit scherm kan doen.
            fout = voorraad.laatsteFout ?? "Het bewaren lukte niet."
        }
    }
}
