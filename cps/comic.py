# -*- coding: utf-8 -*-

#   This file is part of the Calibre-Web (https://github.com/janeczku/calibre-web)
#     Copyright (C) 2018-2022 OzzieIsaacs
#
#   This program is free software: you can redistribute it and/or modify
#   it under the terms of the GNU General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   This program is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU General Public License for more details.
#
#   You should have received a copy of the GNU General Public License
#   along with this program. If not, see <http://www.gnu.org/licenses/>.

import os

from . import logger, isoLanguages, cover
from .constants import BookMeta

try:
    from wand.image import Image
    use_IM = True
except (ImportError, RuntimeError) as e:
    use_IM = False

log = logger.create()

try:
    from comicapi.comicarchive import ComicArchive, MetaDataStyle
    use_comic_meta = True
    try:
        from comicapi import __version__ as comic_version
    except ImportError:
        comic_version = ''
    try:
        from comicapi.comicarchive import load_archive_plugins
        import comicapi.utils
        comicapi.utils.add_rar_paths()
    except ImportError:
        load_archive_plugins = None
except (ImportError, LookupError) as e:
    log.debug('Cannot import comicapi, extracting comic metadata will not work: %s', e)
    import zipfile
    import tarfile
    try:
        import rarfile
        use_rarfile = True
    except (ImportError, SyntaxError) as e:
        log.debug('Cannot import rarfile, extracting cover files from rar files will not work: %s', e)
        use_rarfile = False
    use_comic_meta = False


def _extract_cover_from_archive(original_file_extension, tmp_file_name, rar_executable):
    cover_data = extension = None
    if original_file_extension.upper() == '.CBZ':
        cf = zipfile.ZipFile(tmp_file_name)
        for name in cf.namelist():
            ext = os.path.splitext(name)
            if len(ext) > 1:
                extension = ext[1].lower()
                if extension in cover.COVER_EXTENSIONS:
                    cover_data = cf.read(name)
                    break
    elif original_file_extension.upper() == '.CBT':
        cf = tarfile.TarFile(tmp_file_name)
        for name in cf.getnames():
            ext = os.path.splitext(name)
            if len(ext) > 1:
                extension = ext[1].lower()
                if extension in cover.COVER_EXTENSIONS:
                    cover_data = cf.extractfile(name).read()
                    break
    elif original_file_extension.upper() == '.CBR' and use_rarfile:
        try:
            rarfile.UNRAR_TOOL = rar_executable
            cf = rarfile.RarFile(tmp_file_name)
            for name in cf.namelist():
                ext = os.path.splitext(name)
                if len(ext) > 1:
                    extension = ext[1].lower()
                    if extension in cover.COVER_EXTENSIONS:
                        cover_data = cf.read(name)
                        break
        except Exception as ex:
            log.debug('Rarfile failed with error: {}'.format(ex))
    return cover_data, extension


def _extract_cover(tmp_file_name, original_file_extension, rar_executable):
    cover_data = extension = None
    if use_comic_meta:
        try:
            archive = ComicArchive(tmp_file_name, rar_exe_path=rar_executable)
        except TypeError:
            archive = ComicArchive(tmp_file_name)
        name_list = archive.getPageNameList if hasattr(archive, "getPageNameList") else archive.get_page_name_list
        for index, name in enumerate(name_list()):
            ext = os.path.splitext(name)
            if len(ext) > 1:
                extension = ext[1].lower()
                if extension in cover.COVER_EXTENSIONS:
                    get_page = archive.getPage if hasattr(archive, "getPageNameList") else archive.get_page
                    cover_data = get_page(index)
                    break
    else:
        cover_data, extension = _extract_cover_from_archive(original_file_extension, tmp_file_name, rar_executable)
    return cover.cover_processing(tmp_file_name, cover_data, extension)


def get_comic_info(tmp_file_path, original_file_name, original_file_extension, rar_executable):
    if use_comic_meta:
        try:
            archive = ComicArchive(tmp_file_path, rar_exe_path=rar_executable)
        except TypeError:
            load_archive_plugins(force=True, rar=rar_executable)
            archive = ComicArchive(tmp_file_path)
        if hasattr(archive, "seemsToBeAComicArchive"):
            seems_archive = archive.seemsToBeAComicArchive
        else:
            seems_archive = archive.seems_to_be_a_comic_archive
        if seems_archive():
            has_metadata = archive.hasMetadata if hasattr(archive, "hasMetadata") else archive.has_metadata
            if has_metadata(MetaDataStyle.CIX):
                style = MetaDataStyle.CIX
            elif has_metadata(MetaDataStyle.CBI):
                style = MetaDataStyle.CBI
            else:
                style = None

            read_metadata = archive.readMetadata if hasattr(archive, "readMetadata") else archive.read_metadata
            loaded_metadata = read_metadata(style)

            lang = loaded_metadata.language or ""
            loaded_metadata.language = isoLanguages.get_lang3(lang)

            if (loaded_metadata.page_count == None):
                # get pageCountManualy
                loaded_metadata.page_count = archive.getNumberOfPages()
            return BookMeta(
                file_path=tmp_file_path,
                extension=original_file_extension,
                title=loaded_metadata.title or original_file_name,
                author=" & ".join([credit["person"]
                                   for credit in loaded_metadata.credits if credit["role"] == "Writer"]) or 'Unknown',
                cover=_extract_cover(tmp_file_path, original_file_extension, rar_executable),
                description=loaded_metadata.comments or "",
                tags=loaded_metadata.tags or "",
                series=loaded_metadata.series or "",
                series_id=loaded_metadata.issue or "",
                languages=loaded_metadata.language,
                publisher=loaded_metadata.publisher or "",
                pubdate="",
                identifiers=[],
                page_count=loaded_metadata.page_count
                )

    return BookMeta(
        file_path=tmp_file_path,
        extension=original_file_extension,
        title=original_file_name,
        author='Unknown',
        cover=_extract_cover(tmp_file_path, original_file_extension, rar_executable),
        description="",
        tags="",
        series="",
        series_id="",
        languages="",
        publisher="",
        pubdate="",
        identifiers=[])



def extract_page(tmp_file_name, original_file_extension, rar_executable, pageNum):
    if use_comic_meta:
        archive = ComicArchive(tmp_file_name, rar_exe_path=rar_executable)
        return archive.getPage(pageNum), archive.getPageName(pageNum)
    else:
        cover_data, filename = _extract_page_from_archive(original_file_extension, tmp_file_name, rar_executable)
    return cover_data, filename # cover.cover_processing(tmp_file_name, cover_data, extension)

def _extract_page_from_archive(original_file_extension, tmp_file_name, rar_executable, pageNum):
    page_data = None
    page_name = None
    if original_file_extension.upper() == '.CBZ':
        cf = zipfile.ZipFile(tmp_file_name)
        for name in cf.namelist():
            root, ext = os.path.splitext(name)
            if root.endswith(pageNum):
                page_data = cf.read(name)
                page_name = name
                break
    elif original_file_extension.upper() == '.CBT':
        cf = tarfile.TarFile(tmp_file_name)
        for name in cf.getnames():
            root, ext = os.path.splitext(name)
            if root.endswith(pageNum):
                page_data = cf.extractfile(name).read()
                page_name = name
                break
    elif original_file_extension.upper() == '.CBR' and use_rarfile:
        try:
            rarfile.UNRAR_TOOL = rar_executable
            cf = rarfile.RarFile(tmp_file_name)
            for name in cf.namelist():
                root, ext = os.path.splitext(name)
                if root.endswith(pageNum):
                    page_data = cf.read(name)
                    page_name = name
                    break
        except Exception as ex:
            log.debug('Rarfile failed with error: {}'.format(ex))
    return page_data, page_name