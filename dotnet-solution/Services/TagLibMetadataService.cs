using System;
using System.IO;
using SpliceIt.Models;
using TagLib;
using File = TagLib.File;

namespace SpliceIt.Services;

public sealed class TagLibMetadataService
{
    /// <summary>
    /// Reads ID3v1, ID3v2, Vorbis, and MP4 metadata from any audio file into the unified model.
    /// </summary>
    public AudioMetadata ReadMetadata(string audioFilePath)
    {
        if (!System.IO.File.Exists(audioFilePath))
            throw new FileNotFoundException("Audio file not found", audioFilePath);

        using var tagFile = File.Create(audioFilePath);
        var tag = tagFile.Tag;

        var metadata = new AudioMetadata
        {
            Title = tag.Title ?? Path.GetFileNameWithoutExtension(audioFilePath),
            Artist = tag.FirstPerformer ?? tag.FirstAlbumArtist ?? string.Empty,
            Album = tag.Album ?? string.Empty,
            Year = tag.Year,
            TrackNumber = tag.Track,
            DiscNumber = tag.Disc,
            Genre = tag.FirstGenre ?? string.Empty,
            Comment = tag.Comment ?? string.Empty,
            Composer = tag.FirstComposer ?? string.Empty,
            Copyright = tag.Copyright ?? string.Empty,
            Lyrics = tag.Lyrics ?? string.Empty,
            Bpm = tag.BeatsPerMinute,
            Isrc = tag.ISRC ?? string.Empty
        };

        // Extract front album cover artwork if present
        if (tag.Pictures.Length > 0)
        {
            var picture = tag.Pictures[0];
            metadata.CoverArtBase64 = Convert.ToBase64String(picture.Data.Data);
        }

        return metadata;
    }

    /// <summary>
    /// Writes and overwrites metadata tags directly into an audio file (ID3v2, Vorbis, FLAC, MP4).
    /// </summary>
    public void WriteMetadata(string audioFilePath, AudioMetadata metadata)
    {
        if (!System.IO.File.Exists(audioFilePath))
            throw new FileNotFoundException("Target audio file not found", audioFilePath);

        using var tagFile = File.Create(audioFilePath);
        var tag = tagFile.Tag;

        tag.Title = metadata.Title;
        tag.Performers = string.IsNullOrEmpty(metadata.Artist) ? Array.Empty<string>() : new[] { metadata.Artist };
        tag.Album = metadata.Album;
        tag.Year = metadata.Year;
        tag.Track = metadata.TrackNumber;
        tag.Disc = metadata.DiscNumber;
        tag.Genres = string.IsNullOrEmpty(metadata.Genre) ? Array.Empty<string>() : new[] { metadata.Genre };
        tag.Comment = metadata.Comment;
        tag.Composers = string.IsNullOrEmpty(metadata.Composer) ? Array.Empty<string>() : new[] { metadata.Composer };
        tag.Copyright = metadata.Copyright;
        tag.Lyrics = metadata.Lyrics;
        tag.BeatsPerMinute = (uint)Math.Round(metadata.Bpm);
        tag.ISRC = metadata.Isrc;

        // Embed Cover Artwork if provided in Base64
        if (!string.IsNullOrEmpty(metadata.CoverArtBase64))
        {
            try
            {
                byte[] imageBytes = Convert.FromBase64String(metadata.CoverArtBase64);
                var picture = new ByteVector(imageBytes);
                var ipic = new Picture(picture)
                {
                    Type = PictureType.FrontCover,
                    MimeType = "image/png",
                    Description = "Front Album Cover"
                };
                tag.Pictures = new IPicture[] { ipic };
            }
            catch
            {
                // Fallback gracefully on corrupt image data
            }
        }

        tagFile.Save();
    }
}
