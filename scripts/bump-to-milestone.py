#!/usr/bin/env python3
"""
Script per fare il bump automatico alla prossima milestone dalla ROADMAP.

Uso:
  python scripts/bump-to-milestone.py          # Bump alla prossima milestone
  python scripts/bump-to-milestone.py --dry-run  # Preview senza modificare
  python scripts/bump-to-milestone.py --list   # Lista tutte le milestone

Prerequisiti:
  - .release-please-manifest.json esiste
  - docs/ROADMAP.md è aggiornato con Milestone vX.Y.Z
"""

import re
import json
import sys
from pathlib import Path
from typing import List, Tuple


def parse_version(v: str) -> Tuple[int, int, int]:
    """Converte 'vX.Y.Z' o 'X.Y.Z' in tupla di interi."""
    clean = v.lstrip("v")
    try:
        parts = clean.split(".")
        return (int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, IndexError):
        return (0, 0, 0)


def extract_milestones(roadmap_path: str) -> List[str]:
    """Estrae tutte le milestone dal file ROADMAP."""
    roadmap = Path(roadmap_path).read_text(encoding="utf-8")
    # Cerca: ## Milestone v0.6.0 - Descrizione
    milestones = re.findall(r"## Milestone (v[\d.]+)", roadmap)
    return sorted(milestones, key=parse_version)


def get_current_version(manifest_path: str) -> str:
    """Legge la versione attuale dal manifest."""
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    return f"v{manifest.get('.', '0.0.0')}"


def get_next_milestone(current: str, milestones: List[str]) -> str:
    """Trova la prossima milestone oltre quella attuale."""
    current_tuple = parse_version(current)
    
    for m in milestones:
        m_tuple = parse_version(m)
        if m_tuple > current_tuple:
            return m
    
    return None


def update_manifest(new_version: str, manifest_path: str) -> None:
    """Aggiorna il manifest con la nuova versione."""
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    manifest["."] = new_version.lstrip("v")
    Path(manifest_path).write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8"
    )


def main():
    """Entry point principale."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Bump a prossima milestone")
    parser.add_argument("--dry-run", action="store_true", help="Preview senza modificare")
    parser.add_argument("--list", action="store_true", help="Lista milestone e versione attuale")
    
    args = parser.parse_args()
    
    roadmap_path = "docs/ROADMAP.md"
    manifest_path = ".release-please-manifest.json"
    
    if not Path(roadmap_path).exists():
        print(f"❌ Errore: {roadmap_path} non trovato")
        sys.exit(1)
    
    if not Path(manifest_path).exists():
        print(f"❌ Errore: {manifest_path} non trovato")
        sys.exit(1)
    
    # Estrai milestone
    milestones = extract_milestones(roadmap_path)
    current = get_current_version(manifest_path)
    
    if args.list:
        print(f"📋 Milestone disponibili:")
        for m in milestones:
            marker = "→ " if m == current else "  "
            print(f"  {marker}{m}")
        print(f"\n📌 Versione attuale: {current}")
        return
    
    # Determina prossima milestone
    next_milestone = get_next_milestone(current, milestones)
    
    if not next_milestone:
        print(f"❌ Nessuna nuova milestone trovata oltre {current}")
        print(f"   Milestone disponibili: {', '.join(milestones)}")
        sys.exit(1)
    
    print(f"📈 Versione attuale: {current}")
    print(f"🎯 Prossima milestone: {next_milestone}")
    
    if args.dry_run:
        print(f"\n🔍 [DRY-RUN] Sarebbe aggiornato {manifest_path} con {next_milestone}")
        return
    
    # Aggiorna manifest
    update_manifest(next_milestone, manifest_path)
    print(f"✅ {manifest_path} aggiornato a {next_milestone}")
    print(f"\n💡 Prossimo passo:")
    print(f"   git add .release-please-manifest.json")
    print(f"   git commit -m \"chore(release): bump to {next_milestone}\"")
    print(f"   git push")


if __name__ == "__main__":
    main()
