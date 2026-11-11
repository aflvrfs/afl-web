import { Directory, File, Paths } from 'expo-file-system';

/**
 * Fotos werden als Dateien im privaten Dokumentenordner der App abgelegt
 * (durch die iOS-Datenverschlüsselung geschützt). In den Daten wird nur
 * der Dateiname gespeichert, damit Pfadänderungen nach Updates nichts kaputt machen.
 */
function photoDirectory(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function photoUri(fileName: string): string {
  return new File(photoDirectory(), fileName).uri;
}

/** Kopiert ein aufgenommenes oder ausgewähltes Bild dauerhaft in die App. */
export function importPhoto(sourceUri: string, fileName: string): void {
  const source = new File(sourceUri);
  const target = new File(photoDirectory(), fileName);
  if (target.exists) target.delete();
  source.copy(target);
}

export function deletePhotoFile(fileName: string): void {
  try {
    const file = new File(photoDirectory(), fileName);
    if (file.exists) file.delete();
  } catch {
    // Datei existiert bereits nicht mehr – nichts zu tun.
  }
}

export function deleteAllPhotoFiles(): void {
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (dir.exists) dir.delete();
  } catch {
    // ignorieren
  }
}
