const I18n = (() => {
  const SUPPORTED = ["de", "en", "fr", "es", "it"];
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "metameteo.lang";

  const LOCALES = {
    de: "de-DE",
    en: "en-GB",
    fr: "fr-FR",
    es: "es-ES",
    it: "it-IT",
  };

  const LANGUAGES = [
    { code: "de", name: "Deutsch" },
    { code: "en", name: "English" },
    { code: "fr", name: "Français" },
    { code: "es", name: "Español" },
    { code: "it", name: "Italiano" },
  ];

  const CARDINALS = {
    de: ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],
    en: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],
    fr: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"],
    es: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"],
    it: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"],
  };

  const TICK_FORMATS = {
    de: { hourly: "%d.%m. %Hh", daily: "%a" },
    en: { hourly: "%d/%m %H:%M", daily: "%a" },
    fr: { hourly: "%d/%m %H:%M", daily: "%a" },
    es: { hourly: "%d/%m %H:%M", daily: "%a" },
    it: { hourly: "%d/%m %H:%M", daily: "%a" },
  };

  const WEEKDAYS = {
    de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    fr: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    it: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
  };

  const TRANSLATIONS = {
    de: {
      "brand.tagline": "Stündliche Vorhersage als Mittelwert mehrerer Wettermodelle – mit Streuung als Fehlerband.",
      "search.placeholder": "Ort suchen (z. B. Berlin)",
      "mode.hourly": "stündlich",
      "mode.daily": "täglich",
      "toolbar.resetZoom": "Zoom für alle zurücksetzen",
      "toolbar.refresh": "Aktualisieren",
      "toolbar.refreshTitle": "Vorhersage für diesen Ort neu laden",
      "window.hint": "Anzeige ab jetzt: erste 3 Tage – für alle 7 Tage zoomen",
      "status.loading": "Lade Vorhersage …",
      "status.ready": "Fertig.",
      "status.geocodeError": "Ortssuche fehlgeschlagen: {{message}}",
      "status.forecastError": "Vorhersage fehlgeschlagen: {{message}}",
      "status.favoritesLoadError": "Favoriten konnten nicht geladen werden: {{message}}",
      "status.favoriteSaveError": "Favorit konnte nicht gespeichert werden: {{message}}",
      "status.favoriteRemoveError": "Favorit konnte nicht entfernt werden: {{message}}",
      "status.orderSaveError": "Reihenfolge konnte nicht gespeichert werden: {{message}}",
      "status.noData": "Keine Daten für diese Auflösung verfügbar.",
      "favorites.empty": "Noch keine Favoriten – Ort suchen und mit ☆ hinzufügen.",
      "favorites.removeTitle": "Favorit entfernen",
      "location.modelsWithData": "{{used}} von {{total}} Modellen mit Daten",
      "location.updated": "Daten abgerufen: {{datetime}}",
      "location.updatedTitle": "Zeitpunkt des letzten frischen Abrufs der Modelldaten vom Server, in deine Zeitzone umgerechnet. Bei einem Cache-Treffer bleibt der Wert stehen; der Aktualisieren-Button erzwingt einen neuen Abruf. Das ist nicht der Zeitpunkt des Modelllaufs.",
      "location.starOn": "★ Favorit",
      "location.starOff": "☆ Favorit",
      "location.starOnTitle": "Aus Favoriten entfernen",
      "location.starOffTitle": "Zu Favoriten hinzufügen",
      "chart.applyZoom": "Zoom auf alle anwenden",
      "chart.applyZoomTitle": "Aktuellen X-Zoom dieses Charts auf alle anderen Charts anwenden",
      "badge.dailyOnly": "nur täglich aufgelöst",
      "badge.singleModel": "nur 1 Modell",
      "badge.modelCount": "Modellanzahl {{min}}–{{max}}",
      "chart.legendStd": "1σ Abweichung",
      "chart.legendMean": "Mittelwert",
      "chart.legendDirection": "Windrichtung (Pfeile)",
      "chart.hoverMeanTemplate": "<b>%{x}</b><br>Mittelwert: %{customdata[0]}<br>%{customdata[1]} Modelle<extra></extra>",
      "chart.hoverOverlayTemplate": "<b>%{x}</b><br>{{label}}: %{customdata[0]}<br>%{customdata[1]} Modelle<extra></extra>",
      "chart.hoverDirectionTemplate": "<b>%{x}</b><br>Wind aus %{customdata[1]} (%{customdata[0]})<br>Streuung: ±%{customdata[2]}<br>%{customdata[3]} Modelle<extra></extra>",
      "models.title": "Genutzte Modelle je Parameter",
      "models.summary": "Abgefragt für diesen Ort: {{models}} ({{count}} Modelle).",
      "models.used": "{{used}} von {{total}}: {{models}}",
      "models.none": "0 von {{total}}: keine Daten",
      "models.missing": "nicht geliefert: {{models}}",
      "models.coverage": "Modellanzahl über den Zeitraum: {{min}}–{{max}}",
      "panel.noteDashed": "gestrichelt im Chart „{{chart}}“",
      "panel.noteArrows": "als Pfeile im Chart „{{chart}}“",
      "chart.temperature.label": "Temperatur (2 m)",
      "chart.temperature.info": "Lufttemperatur in 2 m Höhe über Grund – die meteorologische Standard-Messhöhe.",
      "chart.temperature.overlay": "Gefühlte Temperatur",
      "chart.sunshine.label": "Sonnenstunden",
      "chart.sunshine.info": "Sonnenscheindauer: stündlich = Sonnenstunden dieser Stunde, täglich = Tagessumme. Die gestrichelte Linie zeigt die Bewölkung.",
      "chart.sunshine.overlay": "Bewölkung",
      "chart.wind.label": "Wind (10 m)",
      "chart.wind.info": "Windgeschwindigkeit in 10 m Höhe über Grund – die meteorologische Standard-Messhöhe. Wind in 2 m Höhe ist bei Open-Meteo nicht verfügbar. Die Pfeile zeigen die mittlere Strömungsrichtung; blasser = Modelle uneiniger.",
      "chart.wind.direction": "Windrichtung",
      "chart.precipProb.label": "Niederschlagswahrscheinlichkeit",
      "chart.precipProb.info": "Wahrscheinlichkeit für Niederschlag (0–100 %). Nicht jedes Modell liefert diesen Wert.",
      "chart.precip.label": "Niederschlagsmenge",
      "chart.precip.info": "Erwartete Niederschlagsmenge in mm.",
      "chart.uv.label": "UV-Index",
      "chart.uv.info": "UV-Index (0 = niedrig, ab 3 erhöhter Schutzbedarf, ab 8 sehr hoch).",
      "chart.pressure.label": "Luftdruck",
      "chart.pressure.info": "Luftdruck auf Meeresniveau in hPa – auf Meeresniveau reduziert und daher höhenunabhängig. Die farbigen Bänder ordnen den Verlauf meteorologisch ein.",
      "band.low": "Tiefdruck",
      "band.slightlyBelow": "Leicht unterdurchschnittlich",
      "band.normal": "Normalbereich",
      "band.high": "Hochdruck",
    },
    en: {
      "brand.tagline": "Hourly forecast as the mean of several weather models – with spread shown as an error band.",
      "search.placeholder": "Search for a place (e.g. Berlin)",
      "mode.hourly": "hourly",
      "mode.daily": "daily",
      "toolbar.resetZoom": "Reset zoom for all",
      "toolbar.refresh": "Refresh",
      "toolbar.refreshTitle": "Reload the forecast for this place",
      "window.hint": "Showing the first 3 days from now – zoom out for all 7 days",
      "status.loading": "Loading forecast …",
      "status.ready": "Done.",
      "status.geocodeError": "Place search failed: {{message}}",
      "status.forecastError": "Forecast failed: {{message}}",
      "status.favoritesLoadError": "Could not load favorites: {{message}}",
      "status.favoriteSaveError": "Could not save favorite: {{message}}",
      "status.favoriteRemoveError": "Could not remove favorite: {{message}}",
      "status.orderSaveError": "Could not save the order: {{message}}",
      "status.noData": "No data available for this resolution.",
      "favorites.empty": "No favorites yet – search for a place and add it with ☆.",
      "favorites.removeTitle": "Remove favorite",
      "location.modelsWithData": "{{used}} of {{total}} models with data",
      "location.updated": "Data fetched: {{datetime}}",
      "location.updatedTitle": "Time of the last fresh fetch of the model data from the server, converted to your time zone. On a cache hit the value stays unchanged; the Refresh button forces a new fetch. This is not the model run time.",
      "location.starOn": "★ Favorite",
      "location.starOff": "☆ Favorite",
      "location.starOnTitle": "Remove from favorites",
      "location.starOffTitle": "Add to favorites",
      "chart.applyZoom": "Apply zoom to all",
      "chart.applyZoomTitle": "Apply this chart's current X zoom to all other charts",
      "badge.dailyOnly": "daily only",
      "badge.singleModel": "only 1 model",
      "badge.modelCount": "Model count {{min}}–{{max}}",
      "chart.legendStd": "1σ spread",
      "chart.legendMean": "Mean",
      "chart.legendDirection": "Wind direction (arrows)",
      "chart.hoverMeanTemplate": "<b>%{x}</b><br>Mean: %{customdata[0]}<br>%{customdata[1]} models<extra></extra>",
      "chart.hoverOverlayTemplate": "<b>%{x}</b><br>{{label}}: %{customdata[0]}<br>%{customdata[1]} models<extra></extra>",
      "chart.hoverDirectionTemplate": "<b>%{x}</b><br>Wind from %{customdata[1]} (%{customdata[0]})<br>Spread: ±%{customdata[2]}<br>%{customdata[3]} models<extra></extra>",
      "models.title": "Models used per parameter",
      "models.summary": "Requested for this place: {{models}} ({{count}} models).",
      "models.used": "{{used}} of {{total}}: {{models}}",
      "models.none": "0 of {{total}}: no data",
      "models.missing": "not provided: {{models}}",
      "models.coverage": "Model count over the period: {{min}}–{{max}}",
      "panel.noteDashed": "dashed in the “{{chart}}” chart",
      "panel.noteArrows": "as arrows in the “{{chart}}” chart",
      "chart.temperature.label": "Temperature (2 m)",
      "chart.temperature.info": "Air temperature at 2 m above ground – the standard meteorological measurement height.",
      "chart.temperature.overlay": "Feels-like temperature",
      "chart.sunshine.label": "Sunshine hours",
      "chart.sunshine.info": "Sunshine duration: hourly = sunshine hours in that hour, daily = daily total. The dashed line shows cloud cover.",
      "chart.sunshine.overlay": "Cloud cover",
      "chart.wind.label": "Wind (10 m)",
      "chart.wind.info": "Wind speed at 10 m above ground – the standard meteorological measurement height. Wind at 2 m is not available from Open-Meteo. The arrows show the mean flow direction; fainter = models less in agreement.",
      "chart.wind.direction": "Wind direction",
      "chart.precipProb.label": "Precipitation probability",
      "chart.precipProb.info": "Probability of precipitation (0–100 %). Not every model provides this value.",
      "chart.precip.label": "Precipitation amount",
      "chart.precip.info": "Expected precipitation amount in mm.",
      "chart.uv.label": "UV index",
      "chart.uv.info": "UV index (0 = low, from 3 increased protection needed, from 8 very high).",
      "chart.pressure.label": "Air pressure",
      "chart.pressure.info": "Air pressure at sea level in hPa – reduced to sea level and therefore independent of altitude. The coloured bands place the course in a meteorological context.",
      "band.low": "Low pressure",
      "band.slightlyBelow": "Slightly below average",
      "band.normal": "Normal range",
      "band.high": "High pressure",
    },
    fr: {
      "brand.tagline": "Prévision horaire comme moyenne de plusieurs modèles météo – avec l'écart indiqué sous forme de bande d'erreur.",
      "search.placeholder": "Rechercher un lieu (p. ex. Berlin)",
      "mode.hourly": "horaire",
      "mode.daily": "quotidien",
      "toolbar.resetZoom": "Réinitialiser le zoom pour tous",
      "toolbar.refresh": "Actualiser",
      "toolbar.refreshTitle": "Recharger les prévisions pour ce lieu",
      "window.hint": "Affichage à partir de maintenant : 3 premiers jours – zoomez pour les 7 jours",
      "status.loading": "Chargement des prévisions …",
      "status.ready": "Terminé.",
      "status.geocodeError": "Échec de la recherche de lieu : {{message}}",
      "status.forecastError": "Échec des prévisions : {{message}}",
      "status.favoritesLoadError": "Impossible de charger les favoris : {{message}}",
      "status.favoriteSaveError": "Impossible d'enregistrer le favori : {{message}}",
      "status.favoriteRemoveError": "Impossible de supprimer le favori : {{message}}",
      "status.orderSaveError": "Impossible d'enregistrer l'ordre : {{message}}",
      "status.noData": "Aucune donnée disponible pour cette résolution.",
      "favorites.empty": "Aucun favori pour l'instant – recherchez un lieu et ajoutez-le avec ☆.",
      "favorites.removeTitle": "Supprimer le favori",
      "location.modelsWithData": "{{used}} sur {{total}} modèles avec données",
      "location.updated": "Données récupérées : {{datetime}}",
      "location.updatedTitle": "Moment du dernier chargement frais des données de modèle depuis le serveur, converti dans votre fuseau horaire. En cas de cache, la valeur ne change pas ; le bouton Actualiser force un nouveau chargement. Ce n'est pas l'heure du passage du modèle.",
      "location.starOn": "★ Favori",
      "location.starOff": "☆ Favori",
      "location.starOnTitle": "Retirer des favoris",
      "location.starOffTitle": "Ajouter aux favoris",
      "chart.applyZoom": "Appliquer le zoom à tous",
      "chart.applyZoomTitle": "Appliquer le zoom X actuel de ce graphique à tous les autres",
      "badge.dailyOnly": "quotidien uniquement",
      "badge.singleModel": "1 seul modèle",
      "badge.modelCount": "Nombre de modèles {{min}}–{{max}}",
      "chart.legendStd": "écart 1σ",
      "chart.legendMean": "Moyenne",
      "chart.legendDirection": "Direction du vent (flèches)",
      "chart.hoverMeanTemplate": "<b>%{x}</b><br>Moyenne : %{customdata[0]}<br>%{customdata[1]} modèles<extra></extra>",
      "chart.hoverOverlayTemplate": "<b>%{x}</b><br>{{label}} : %{customdata[0]}<br>%{customdata[1]} modèles<extra></extra>",
      "chart.hoverDirectionTemplate": "<b>%{x}</b><br>Vent venant de %{customdata[1]} (%{customdata[0]})<br>Écart : ±%{customdata[2]}<br>%{customdata[3]} modèles<extra></extra>",
      "models.title": "Modèles utilisés par paramètre",
      "models.summary": "Interrogés pour ce lieu : {{models}} ({{count}} modèles).",
      "models.used": "{{used}} sur {{total}} : {{models}}",
      "models.none": "0 sur {{total}} : aucune donnée",
      "models.missing": "non fournis : {{models}}",
      "models.coverage": "Nombre de modèles sur la période : {{min}}–{{max}}",
      "panel.noteDashed": "en pointillé dans le graphique « {{chart}} »",
      "panel.noteArrows": "sous forme de flèches dans le graphique « {{chart}} »",
      "chart.temperature.label": "Température (2 m)",
      "chart.temperature.info": "Température de l'air à 2 m au-dessus du sol – hauteur de mesure météorologique standard.",
      "chart.temperature.overlay": "Température ressentie",
      "chart.sunshine.label": "Heures d'ensoleillement",
      "chart.sunshine.info": "Durée d'ensoleillement : horaire = heures de soleil de l'heure, quotidien = total du jour. La ligne en pointillé indique la couverture nuageuse.",
      "chart.sunshine.overlay": "Couverture nuageuse",
      "chart.wind.label": "Vent (10 m)",
      "chart.wind.info": "Vitesse du vent à 10 m au-dessus du sol – hauteur de mesure météorologique standard. Le vent à 2 m n'est pas disponible chez Open-Meteo. Les flèches indiquent la direction moyenne du flux ; plus pâle = modèles moins d'accord.",
      "chart.wind.direction": "Direction du vent",
      "chart.precipProb.label": "Probabilité de précipitation",
      "chart.precipProb.info": "Probabilité de précipitation (0–100 %). Tous les modèles ne fournissent pas cette valeur.",
      "chart.precip.label": "Quantité de précipitation",
      "chart.precip.info": "Quantité de précipitation attendue en mm.",
      "chart.uv.label": "Indice UV",
      "chart.uv.info": "Indice UV (0 = faible, à partir de 3 protection accrue, à partir de 8 très élevé).",
      "chart.pressure.label": "Pression atmosphérique",
      "chart.pressure.info": "Pression atmosphérique au niveau de la mer en hPa – réduite au niveau de la mer et donc indépendante de l'altitude. Les bandes colorées replacent l'évolution dans un contexte météorologique.",
      "band.low": "Basse pression",
      "band.slightlyBelow": "Légèrement sous la moyenne",
      "band.normal": "Plage normale",
      "band.high": "Haute pression",
    },
    es: {
      "brand.tagline": "Pronóstico horario como media de varios modelos meteorológicos – con la dispersión mostrada como banda de error.",
      "search.placeholder": "Buscar un lugar (p. ej. Berlín)",
      "mode.hourly": "por horas",
      "mode.daily": "diario",
      "toolbar.resetZoom": "Restablecer el zoom para todos",
      "toolbar.refresh": "Actualizar",
      "toolbar.refreshTitle": "Recargar el pronóstico para este lugar",
      "window.hint": "Vista a partir de ahora: primeros 3 días – amplía para ver los 7 días",
      "status.loading": "Cargando pronóstico …",
      "status.ready": "Listo.",
      "status.geocodeError": "Error en la búsqueda de lugares: {{message}}",
      "status.forecastError": "Error en el pronóstico: {{message}}",
      "status.favoritesLoadError": "No se pudieron cargar los favoritos: {{message}}",
      "status.favoriteSaveError": "No se pudo guardar el favorito: {{message}}",
      "status.favoriteRemoveError": "No se pudo eliminar el favorito: {{message}}",
      "status.orderSaveError": "No se pudo guardar el orden: {{message}}",
      "status.noData": "No hay datos disponibles para esta resolución.",
      "favorites.empty": "Aún no hay favoritos – busca un lugar y añádelo con ☆.",
      "favorites.removeTitle": "Eliminar favorito",
      "location.modelsWithData": "{{used}} de {{total}} modelos con datos",
      "location.updated": "Datos obtenidos: {{datetime}}",
      "location.updatedTitle": "Momento de la última obtención fresca de los datos del modelo desde el servidor, convertido a tu zona horaria. Si se usa la caché, el valor no cambia; el botón Actualizar fuerza una nueva consulta. No es la hora de ejecución del modelo.",
      "location.starOn": "★ Favorito",
      "location.starOff": "☆ Favorito",
      "location.starOnTitle": "Quitar de favoritos",
      "location.starOffTitle": "Añadir a favoritos",
      "chart.applyZoom": "Aplicar zoom a todos",
      "chart.applyZoomTitle": "Aplicar el zoom X actual de este gráfico a todos los demás",
      "badge.dailyOnly": "solo diario",
      "badge.singleModel": "solo 1 modelo",
      "badge.modelCount": "Número de modelos {{min}}–{{max}}",
      "chart.legendStd": "dispersión 1σ",
      "chart.legendMean": "Media",
      "chart.legendDirection": "Dirección del viento (flechas)",
      "chart.hoverMeanTemplate": "<b>%{x}</b><br>Media: %{customdata[0]}<br>%{customdata[1]} modelos<extra></extra>",
      "chart.hoverOverlayTemplate": "<b>%{x}</b><br>{{label}}: %{customdata[0]}<br>%{customdata[1]} modelos<extra></extra>",
      "chart.hoverDirectionTemplate": "<b>%{x}</b><br>Viento del %{customdata[1]} (%{customdata[0]})<br>Dispersión: ±%{customdata[2]}<br>%{customdata[3]} modelos<extra></extra>",
      "models.title": "Modelos utilizados por parámetro",
      "models.summary": "Consultados para este lugar: {{models}} ({{count}} modelos).",
      "models.used": "{{used}} de {{total}}: {{models}}",
      "models.none": "0 de {{total}}: sin datos",
      "models.missing": "no proporcionados: {{models}}",
      "models.coverage": "Número de modelos durante el periodo: {{min}}–{{max}}",
      "panel.noteDashed": "discontinuo en el gráfico «{{chart}}»",
      "panel.noteArrows": "como flechas en el gráfico «{{chart}}»",
      "chart.temperature.label": "Temperatura (2 m)",
      "chart.temperature.info": "Temperatura del aire a 2 m sobre el suelo – altura de medición meteorológica estándar.",
      "chart.temperature.overlay": "Temperatura aparente",
      "chart.sunshine.label": "Horas de sol",
      "chart.sunshine.info": "Duración del sol: por horas = horas de sol de esa hora, diario = total del día. La línea discontinua muestra la nubosidad.",
      "chart.sunshine.overlay": "Nubosidad",
      "chart.wind.label": "Viento (10 m)",
      "chart.wind.info": "Velocidad del viento a 10 m sobre el suelo – altura de medición meteorológica estándar. El viento a 2 m no está disponible en Open-Meteo. Las flechas muestran la dirección media del flujo; más tenue = modelos menos de acuerdo.",
      "chart.wind.direction": "Dirección del viento",
      "chart.precipProb.label": "Probabilidad de precipitación",
      "chart.precipProb.info": "Probabilidad de precipitación (0–100 %). No todos los modelos proporcionan este valor.",
      "chart.precip.label": "Cantidad de precipitación",
      "chart.precip.info": "Cantidad de precipitación esperada en mm.",
      "chart.uv.label": "Índice UV",
      "chart.uv.info": "Índice UV (0 = bajo, a partir de 3 mayor necesidad de protección, a partir de 8 muy alto).",
      "chart.pressure.label": "Presión atmosférica",
      "chart.pressure.info": "Presión atmosférica al nivel del mar en hPa – reducida al nivel del mar y por tanto independiente de la altitud. Las bandas de color contextualizan la evolución.",
      "band.low": "Baja presión",
      "band.slightlyBelow": "Ligeramente por debajo de la media",
      "band.normal": "Rango normal",
      "band.high": "Alta presión",
    },
    it: {
      "brand.tagline": "Previsione oraria come media di diversi modelli meteo – con la dispersione mostrata come fascia di errore.",
      "search.placeholder": "Cerca un luogo (es. Berlino)",
      "mode.hourly": "orario",
      "mode.daily": "giornaliero",
      "toolbar.resetZoom": "Reimposta lo zoom per tutti",
      "toolbar.refresh": "Aggiorna",
      "toolbar.refreshTitle": "Ricarica le previsioni per questo luogo",
      "window.hint": "Visualizzazione da ora: primi 3 giorni – ingrandisci per tutti i 7 giorni",
      "status.loading": "Caricamento previsioni …",
      "status.ready": "Fatto.",
      "status.geocodeError": "Ricerca del luogo non riuscita: {{message}}",
      "status.forecastError": "Previsione non riuscita: {{message}}",
      "status.favoritesLoadError": "Impossibile caricare i preferiti: {{message}}",
      "status.favoriteSaveError": "Impossibile salvare il preferito: {{message}}",
      "status.favoriteRemoveError": "Impossibile rimuovere il preferito: {{message}}",
      "status.orderSaveError": "Impossibile salvare l'ordine: {{message}}",
      "status.noData": "Nessun dato disponibile per questa risoluzione.",
      "favorites.empty": "Ancora nessun preferito – cerca un luogo e aggiungilo con ☆.",
      "favorites.removeTitle": "Rimuovi preferito",
      "location.modelsWithData": "{{used}} di {{total}} modelli con dati",
      "location.updated": "Dati scaricati: {{datetime}}",
      "location.updatedTitle": "Momento dell'ultimo scaricamento fresco dei dati del modello dal server, convertito nel tuo fuso orario. In caso di cache il valore resta invariato; il pulsante Aggiorna forza un nuovo scaricamento. Non è l'orario di esecuzione del modello.",
      "location.starOn": "★ Preferito",
      "location.starOff": "☆ Preferito",
      "location.starOnTitle": "Rimuovi dai preferiti",
      "location.starOffTitle": "Aggiungi ai preferiti",
      "chart.applyZoom": "Applica lo zoom a tutti",
      "chart.applyZoomTitle": "Applica l'attuale zoom X di questo grafico a tutti gli altri",
      "badge.dailyOnly": "solo giornaliero",
      "badge.singleModel": "solo 1 modello",
      "badge.modelCount": "Numero di modelli {{min}}–{{max}}",
      "chart.legendStd": "dispersione 1σ",
      "chart.legendMean": "Media",
      "chart.legendDirection": "Direzione del vento (frecce)",
      "chart.hoverMeanTemplate": "<b>%{x}</b><br>Media: %{customdata[0]}<br>%{customdata[1]} modelli<extra></extra>",
      "chart.hoverOverlayTemplate": "<b>%{x}</b><br>{{label}}: %{customdata[0]}<br>%{customdata[1]} modelli<extra></extra>",
      "chart.hoverDirectionTemplate": "<b>%{x}</b><br>Vento da %{customdata[1]} (%{customdata[0]})<br>Dispersione: ±%{customdata[2]}<br>%{customdata[3]} modelli<extra></extra>",
      "models.title": "Modelli utilizzati per parametro",
      "models.summary": "Richiesti per questo luogo: {{models}} ({{count}} modelli).",
      "models.used": "{{used}} di {{total}}: {{models}}",
      "models.none": "0 di {{total}}: nessun dato",
      "models.missing": "non forniti: {{models}}",
      "models.coverage": "Numero di modelli nel periodo: {{min}}–{{max}}",
      "panel.noteDashed": "tratteggiato nel grafico «{{chart}}»",
      "panel.noteArrows": "come frecce nel grafico «{{chart}}»",
      "chart.temperature.label": "Temperatura (2 m)",
      "chart.temperature.info": "Temperatura dell'aria a 2 m dal suolo – altezza di misura meteorologica standard.",
      "chart.temperature.overlay": "Temperatura percepita",
      "chart.sunshine.label": "Ore di sole",
      "chart.sunshine.info": "Durata del sole: orario = ore di sole di quell'ora, giornaliero = totale del giorno. La linea tratteggiata mostra la copertura nuvolosa.",
      "chart.sunshine.overlay": "Copertura nuvolosa",
      "chart.wind.label": "Vento (10 m)",
      "chart.wind.info": "Velocità del vento a 10 m dal suolo – altezza di misura meteorologica standard. Il vento a 2 m non è disponibile su Open-Meteo. Le frecce mostrano la direzione media del flusso; più tenue = modelli meno concordi.",
      "chart.wind.direction": "Direzione del vento",
      "chart.precipProb.label": "Probabilità di precipitazione",
      "chart.precipProb.info": "Probabilità di precipitazione (0–100 %). Non tutti i modelli forniscono questo valore.",
      "chart.precip.label": "Quantità di precipitazione",
      "chart.precip.info": "Quantità di precipitazione prevista in mm.",
      "chart.uv.label": "Indice UV",
      "chart.uv.info": "Indice UV (0 = basso, da 3 maggiore necessità di protezione, da 8 molto alto).",
      "chart.pressure.label": "Pressione atmosferica",
      "chart.pressure.info": "Pressione atmosferica al livello del mare in hPa – ridotta al livello del mare e quindi indipendente dall'altitudine. Le bande colorate inquadrano l'andamento.",
      "band.low": "Bassa pressione",
      "band.slightlyBelow": "Leggermente sotto la media",
      "band.normal": "Intervallo normale",
      "band.high": "Alta pressione",
    },
  };

  function detectLang() {
    let stored = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      stored = null;
    }
    if (stored && SUPPORTED.includes(stored)) return stored;
    const candidates =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || ""];
    for (const candidate of candidates) {
      const base = String(candidate).toLowerCase().split("-")[0];
      if (SUPPORTED.includes(base)) return base;
    }
    return DEFAULT_LANG;
  }

  let currentLang = detectLang();

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return false;
    currentLang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      /* localStorage nicht verfügbar – Auswahl gilt nur für die Sitzung */
    }
    return true;
  }

  function t(key, vars) {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS[DEFAULT_LANG];
    let text = dict[key];
    if (text === undefined) text = TRANSLATIONS[DEFAULT_LANG][key];
    if (text === undefined) return key;
    if (vars) {
      text = text.replace(/\{\{(\w+)\}\}/g, (match, name) =>
        vars[name] !== undefined ? String(vars[name]) : match
      );
    }
    return text;
  }

  function locale() {
    return LOCALES[currentLang] || LOCALES[DEFAULT_LANG];
  }

  function cardinals() {
    return CARDINALS[currentLang] || CARDINALS[DEFAULT_LANG];
  }

  function weekdays() {
    return WEEKDAYS[currentLang] || WEEKDAYS[DEFAULT_LANG];
  }

  function tickFormat(mode) {
    const formats = TICK_FORMATS[currentLang] || TICK_FORMATS[DEFAULT_LANG];
    return mode === "daily" ? formats.daily : formats.hourly;
  }

  function gemName() {
    if (currentLang === "de") return "Kanada GEM";
    if (currentLang === "es") return "Canadá GEM";
    if (currentLang === "it") return "Canada GEM";
    return "Canada GEM";
  }

  return {
    t,
    getLang,
    setLang,
    detectLang,
    locale,
    cardinals,
    weekdays,
    tickFormat,
    gemName,
    supported: SUPPORTED,
    languages: LANGUAGES,
  };
})();
