import SwiftUI

/// Alle recepten, met zoeken en filters.
///
/// Het eerste scherm dat af moet zijn, want het is het scherm dat je het vaakst
/// ziet en het scherm waar de meeste onderdelen in samenkomen: een raster met
/// foto's, een zoekveld dat op ingrediënten zoekt, filterrijen en een lege
/// staat. Klopt dit, dan klopt de rest van de begroting waarschijnlijk ook.
///
/// Zoeken gebeurt lokaal, op wat er in de kast staat. Dat is niet alleen sneller
/// dan het aan de server vragen — het werkt ook zonder bereik, en dat is de hele
/// reden dat er een kast is.
struct OverzichtScherm: View {
    @Environment(Voorraad.self) private var voorraad
    @State private var zoekterm = ""
    @State private var moment: String?
    @State private var dieet: String?

    private var gevonden: [Recept] {
        Zoeker.zoek(
            in: voorraad.recepten,
            termen: Zoeker.termen(zoekterm),
            moment: moment,
            dieet: dieet
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    filterrijen

                    if gevonden.isEmpty {
                        leegteMelding
                            .frame(maxWidth: .infinity)
                            .padding(.top, 48)
                    } else {
                        LazyVGrid(columns: raster, spacing: 18) {
                            ForEach(gevonden) { recept in
                                NavigationLink(value: recept) {
                                    Tegel(recept: recept)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Kleur.papier)
            .navigationTitle("Recepten")
            .navigationDestination(for: Recept.self) { recept in
                ReceptScherm(recept: recept)
            }
            .searchable(
                text: $zoekterm,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Zoek op naam of ingrediënt"
            )
            .refreshable { await voorraad.synchroniseer() }
            .overlay(alignment: .bottom) { foutbalk }
        }
        .tint(Kleur.salie)
    }

    private let raster = [GridItem(.adaptive(minimum: 150), spacing: 14)]

    // MARK: - Onderdelen

    @ViewBuilder
    private var filterrijen: some View {
        let momenten = Set(voorraad.recepten.flatMap(\.momenten)).sorted()
        let dieten = Set(voorraad.recepten.flatMap(\.dieet)).sorted()

        if !momenten.isEmpty {
            Rail(waarden: momenten, gekozen: $moment)
        }
        if !dieten.isEmpty {
            Rail(waarden: dieten, gekozen: $dieet)
        }
    }

    @ViewBuilder
    private var leegteMelding: some View {
        VStack(spacing: 8) {
            if !zoekterm.isEmpty {
                Text("Niets gevonden voor “\(zoekterm)”.")
                    .font(Letter.tekst(17))
                Text("Zoek op een ingrediënt, een gerecht of een keuken.")
                    .font(Letter.tekst(15))
                    .foregroundStyle(Kleur.gedempt)
            } else if voorraad.recepten.isEmpty {
                Text("Nog geen recepten.")
                    .font(Letter.tekst(17))
                Text("Deel een link vanuit Safari of Instagram.")
                    .font(Letter.tekst(15))
                    .foregroundStyle(Kleur.gedempt)
            } else {
                Text("Niks in deze selectie.")
                    .font(Letter.tekst(17))
            }
        }
        .multilineTextAlignment(.center)
        .foregroundStyle(Kleur.tekst)
    }

    @ViewBuilder
    private var foutbalk: some View {
        if let fout = voorraad.laatsteFout {
            Text(fout)
                .font(Letter.tekst(14))
                .foregroundStyle(Kleur.inkt)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Kleur.zand, in: .rect(cornerRadius: 10))
                .padding(16)
                // Een mislukte synchronisatie is geen alarm: de kast staat er
                // nog. Het hoort te melden, niet te blokkeren.
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }
}

/// Een rij chips waarvan er één aan kan staan.
private struct Rail: View {
    let waarden: [String]
    @Binding var gekozen: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(waarden, id: \.self) { waarde in
                    let aan = gekozen == waarde
                    Button {
                        gekozen = aan ? nil : waarde
                    } label: {
                        Text(waarde.capitalized)
                            .font(Letter.tekst(15))
                            .padding(.horizontal, 14)
                            .frame(height: Stijl.raakhoogte - 8)
                            .background(aan ? Kleur.salie : Kleur.vel, in: .capsule)
                            .foregroundStyle(aan ? Kleur.salieInkt : Kleur.tekst)
                            .overlay(
                                Capsule().stroke(aan ? .clear : Kleur.lijn, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
        .scrollClipDisabled()
    }
}

private struct Tegel: View {
    @Environment(Voorraad.self) private var voorraad
    let recept: Recept

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .bottomLeading) {
                Rectangle()
                    .fill(Kleur.verzonken)
                    .aspectRatio(4 / 3, contentMode: .fit)
                    .overlay {
                        if let url = voorraad.fotoURL(recept.foto) {
                            AsyncImage(url: url) { beeld in
                                beeld.resizable().scaledToFill()
                            } placeholder: {
                                Color.clear
                            }
                        }
                    }
                    .clipShape(.rect(cornerRadius: 12))

                if let minuten = recept.totaalMinuten {
                    Label("\(minuten) min", systemImage: "clock")
                        .font(Letter.tekst(12))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Kleur.vel.opacity(0.92), in: .capsule)
                        .foregroundStyle(Kleur.tekst)
                        .padding(8)
                }
            }
            .overlay(alignment: .topTrailing) {
                if recept.favoriet {
                    Image(systemName: "star.fill")
                        .font(.system(size: 11))
                        .padding(7)
                        .background(Kleur.vel.opacity(0.92), in: .circle)
                        .foregroundStyle(Kleur.salie)
                        .padding(8)
                        .accessibilityLabel("Favoriet")
                }
            }

            Text(recept.titel)
                .font(Letter.kop(17))
                .foregroundStyle(Kleur.inkt)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            onderschrift
        }
    }

    @ViewBuilder
    private var onderschrift: some View {
        if let cijfer = recept.cijfer {
            HStack(spacing: 4) {
                Sterren(waarde: Int(cijfer.rounded()))
                if let keuken = recept.keuken {
                    Text(keuken)
                        .font(Letter.tekst(13))
                        .foregroundStyle(Kleur.gedempt)
                }
            }
        } else {
            let regel = ([recept.keuken] + recept.momenten.map(\.capitalized))
                .compactMap { $0 }
                .joined(separator: " · ")
            if !regel.isEmpty {
                Text(regel)
                    .font(Letter.tekst(13))
                    .foregroundStyle(Kleur.gedempt)
            }
        }
    }
}

struct Sterren: View {
    let waarde: Int

    var body: some View {
        HStack(spacing: 1) {
            ForEach(1...5, id: \.self) { nummer in
                Image(systemName: nummer <= waarde ? "star.fill" : "star")
                    .font(.system(size: 10))
            }
        }
        .foregroundStyle(Kleur.ster)
        // Vijf losse sterretjes zijn voor VoiceOver vijf plaatjes; als één
        // waarde is het een cijfer.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(waarde) van 5 sterren")
    }
}
