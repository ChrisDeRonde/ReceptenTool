//
//  ShareViewController.swift
//  Klapper Delen
//
//  Het venster dat opkomt als je vanuit Instagram, Safari of de AH-app op
//  Klapper tikt in het deelmenu. Het doet precies één ding: de gedeelde link
//  of tekst naar `/api/share` sturen, hetzelfde bericht als de Shortcut.
//
//  Er zit geen Klapper-code in dit bestand die iets van de server weet behalve
//  het adres en het token. De server hoeft er niets voor te veranderen.
//
//  Opzetten: zie README.md in deze map.
//

import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {

  // MARK: - Wat er gedeeld wordt

  /// De gedeelde link, als het er een is.
  private var gedeeldeUrl: URL?
  /// De gedeelde tekst, als het geen link was.
  private var gedeeldeTekst: String?

  /// Wie dit deelt. Onthouden tussen keren, zodat het meestal één tik is.
  private var wie: String = Geheimen.laatsteNaam ?? Geheimen.namen.first ?? ""

  // MARK: - Onderdelen op het scherm

  private let kaart = UIView()
  private let titel = UILabel()
  private let voorbeeld = UILabel()
  private let namenRij = UIStackView()
  private let bewaarKnop = UIButton(type: .system)
  private let annuleerKnop = UIButton(type: .system)
  private let melding = UILabel()

  // MARK: - Levensloop

  override func viewDidLoad() {
    super.viewDidLoad()
    bouwScherm()
    leesGedeeldeInhoud()
  }

  // MARK: - De gedeelde inhoud uit het systeem halen

  /// iOS levert het gedeelde ding als een lijstje bijlagen aan. We nemen de
  /// eerste die een link of tekst is; de rest laten we links liggen.
  private func leesGedeeldeInhoud() {
    let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
    let bijlagen = items.flatMap { $0.attachments ?? [] }

    let url = UTType.url.identifier
    let tekst = UTType.plainText.identifier

    // Een link heeft de voorkeur boven tekst: als een app allebei aanbiedt, is
    // de link het bruikbaarst — daar kan de server het recept zelf bij ophalen.
    if let bijlage = bijlagen.first(where: { $0.hasItemConformingToTypeIdentifier(url) }) {
      bijlage.loadItem(forTypeIdentifier: url, options: nil) { [weak self] waarde, _ in
        let gevonden = (waarde as? URL) ?? (waarde as? String).flatMap(URL.init(string:))
        DispatchQueue.main.async {
          self?.gedeeldeUrl = gevonden
          self?.toonVoorbeeld(gevonden?.absoluteString)
        }
      }
      return
    }

    if let bijlage = bijlagen.first(where: { $0.hasItemConformingToTypeIdentifier(tekst) }) {
      bijlage.loadItem(forTypeIdentifier: tekst, options: nil) { [weak self] waarde, _ in
        let gevonden = waarde as? String
        DispatchQueue.main.async {
          self?.gedeeldeTekst = gevonden
          self?.toonVoorbeeld(gevonden)
        }
      }
      return
    }

    toonVoorbeeld(nil)
  }

  private func toonVoorbeeld(_ inhoud: String?) {
    guard let inhoud, !inhoud.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      voorbeeld.text = "Hier zit geen link of tekst in."
      bewaarKnop.isEnabled = false
      bewaarKnop.alpha = 0.45
      return
    }
    voorbeeld.text = inhoud.count > 160 ? String(inhoud.prefix(160)) + "…" : inhoud
    bewaarKnop.isEnabled = true
    bewaarKnop.alpha = 1
  }

  // MARK: - Versturen

  @objc private func bewaar() {
    guard gedeeldeUrl != nil || gedeeldeTekst != nil else { return }

    bewaarKnop.isEnabled = false
    bewaarKnop.alpha = 0.45
    melding.text = "Bezig…"
    melding.isHidden = false

    Geheimen.laatsteNaam = wie

    var lichaam: [String: String] = [:]
    if let url = gedeeldeUrl { lichaam["url"] = url.absoluteString }
    if let tekst = gedeeldeTekst { lichaam["text"] = tekst }
    if !wie.isEmpty { lichaam["sharedBy"] = wie }

    guard
      let adres = URL(string: Geheimen.serverUrl + "/api/share"),
      let json = try? JSONSerialization.data(withJSONObject: lichaam)
    else {
      klaarMet(fout: "Het serveradres klopt niet.")
      return
    }

    var verzoek = URLRequest(url: adres)
    verzoek.httpMethod = "POST"
    verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
    verzoek.setValue("Bearer \(Geheimen.ingestToken)", forHTTPHeaderField: "Authorization")
    verzoek.httpBody = json
    // De server antwoordt met 202 zodra het item veilig staat; het uitschrijven
    // gebeurt daarna op de server. We hoeven dus niet op het model te wachten.
    verzoek.timeoutInterval = 15

    URLSession.shared.dataTask(with: verzoek) { [weak self] _, antwoord, fout in
      DispatchQueue.main.async {
        if let fout {
          self?.klaarMet(fout: "Niet gelukt: \(fout.localizedDescription)")
          return
        }
        let code = (antwoord as? HTTPURLResponse)?.statusCode ?? 0
        switch code {
        case 200..<300:
          self?.klaarMet(fout: nil)
        case 401:
          self?.klaarMet(fout: "Het token klopt niet.")
        default:
          self?.klaarMet(fout: "De server zei \(code).")
        }
      }
    }.resume()
  }

  /// Bij succes even een vinkje en dan weg; bij een fout blijft het venster
  /// staan zodat je kunt lezen wat er misging.
  private func klaarMet(fout: String?) {
    if let fout {
      melding.text = fout
      melding.textColor = Kleur.stop
      bewaarKnop.isEnabled = true
      bewaarKnop.alpha = 1
      return
    }

    melding.text = "Bewaard in Klapper"
    melding.textColor = Kleur.klapper
    namenRij.isHidden = true
    bewaarKnop.isHidden = true

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in
      self?.extensionContext?.completeRequest(returningItems: nil)
    }
  }

  @objc private func annuleer() {
    extensionContext?.cancelRequest(withError: NSError(domain: "nl.klapper.delen", code: 0))
  }

  // MARK: - Het scherm

  private func bouwScherm() {
    view.backgroundColor = UIColor.black.withAlphaComponent(0.25)

    kaart.backgroundColor = Kleur.vel
    kaart.layer.cornerRadius = 16
    kaart.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(kaart)

    titel.text = "Bewaren in Klapper"
    titel.font = .systemFont(ofSize: 19, weight: .semibold)
    titel.textColor = Kleur.inkt

    voorbeeld.text = "…"
    voorbeeld.font = .systemFont(ofSize: 14)
    voorbeeld.textColor = Kleur.gedempt
    voorbeeld.numberOfLines = 3

    melding.font = .systemFont(ofSize: 14, weight: .medium)
    melding.textAlignment = .center
    melding.isHidden = true
    melding.numberOfLines = 2

    bouwNamenRij()

    bewaarKnop.setTitle("Bewaren", for: .normal)
    bewaarKnop.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
    bewaarKnop.setTitleColor(Kleur.vel, for: .normal)
    bewaarKnop.backgroundColor = Kleur.klapper
    bewaarKnop.layer.cornerRadius = 12
    bewaarKnop.addTarget(self, action: #selector(bewaar), for: .touchUpInside)
    bewaarKnop.heightAnchor.constraint(equalToConstant: 48).isActive = true

    annuleerKnop.setTitle("Annuleer", for: .normal)
    annuleerKnop.titleLabel?.font = .systemFont(ofSize: 15)
    annuleerKnop.setTitleColor(Kleur.gedempt, for: .normal)
    annuleerKnop.addTarget(self, action: #selector(annuleer), for: .touchUpInside)

    let stapel = UIStackView(arrangedSubviews: [
      titel, voorbeeld, namenRij, bewaarKnop, melding, annuleerKnop,
    ])
    stapel.axis = .vertical
    stapel.spacing = 14
    stapel.setCustomSpacing(6, after: titel)
    stapel.translatesAutoresizingMaskIntoConstraints = false
    kaart.addSubview(stapel)

    NSLayoutConstraint.activate([
      kaart.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      kaart.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      kaart.widthAnchor.constraint(lessThanOrEqualToConstant: 360),
      kaart.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
      kaart.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),

      stapel.topAnchor.constraint(equalTo: kaart.topAnchor, constant: 22),
      stapel.leadingAnchor.constraint(equalTo: kaart.leadingAnchor, constant: 20),
      stapel.trailingAnchor.constraint(equalTo: kaart.trailingAnchor, constant: -20),
      stapel.bottomAnchor.constraint(equalTo: kaart.bottomAnchor, constant: -18),
    ])
  }

  /// Dezelfde keuze als op het inlogscherm: wie noteert dit. Bij één naam (of
  /// geen) valt de rij weg, want dan valt er niets te kiezen.
  private func bouwNamenRij() {
    namenRij.axis = .horizontal
    namenRij.spacing = 8
    namenRij.distribution = .fillEqually

    guard Geheimen.namen.count > 1 else {
      namenRij.isHidden = true
      return
    }

    for naam in Geheimen.namen {
      let knop = UIButton(type: .system)
      knop.setTitle(naam, for: .normal)
      knop.titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
      knop.layer.cornerRadius = 10
      knop.layer.borderWidth = 1
      knop.heightAnchor.constraint(equalToConstant: 42).isActive = true
      knop.addAction(UIAction { [weak self] _ in
        self?.wie = naam
        self?.kleurNamen()
      }, for: .touchUpInside)
      namenRij.addArrangedSubview(knop)
    }
    kleurNamen()
  }

  private func kleurNamen() {
    for (index, deel) in namenRij.arrangedSubviews.enumerated() {
      guard let knop = deel as? UIButton, index < Geheimen.namen.count else { continue }
      let aan = Geheimen.namen[index] == wie
      knop.backgroundColor = aan ? Kleur.klapperZacht : .clear
      knop.layer.borderColor = (aan ? Kleur.klapper : Kleur.lijn).cgColor
      knop.setTitleColor(aan ? Kleur.klapper : Kleur.inkt, for: .normal)
    }
  }
}

/// De kleuren van de app, zodat het venster erbij hoort. Dezelfde waarden als
/// in `globals.css`; ze volgen de licht/donker-stand van het toestel.
private enum Kleur {
  static let klapper = dynamisch(licht: 0x477060, donker: 0x93BDA6)
  static let klapperZacht = dynamisch(licht: 0xE1EBE4, donker: 0x25332C)
  static let vel = dynamisch(licht: 0xFFFEFA, donker: 0x1E1C19)
  static let inkt = dynamisch(licht: 0x1E1C18, donker: 0xF5EFE5)
  static let gedempt = dynamisch(licht: 0x6E6760, donker: 0x9A9287)
  static let lijn = dynamisch(licht: 0xE5DED0, donker: 0x35302A)
  static let stop = dynamisch(licht: 0x9D5245, donker: 0xDC9583)

  private static func dynamisch(licht: Int, donker: Int) -> UIColor {
    UIColor { stand in
      stand.userInterfaceStyle == .dark ? UIColor(hex: donker) : UIColor(hex: licht)
    }
  }
}

private extension UIColor {
  convenience init(hex: Int) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1
    )
  }
}
