{
  "steps": {
    "image_thumb": {
        "use": ":original"
      , "robot": "/image/resize"
      , "correct_gamma": true
      , "width": 232
      , "resize_strategy": "fit"
    },
    "image_full": {
        "use": ":original"
      , "robot": "/image/resize"
      , "strip": true
      , "correct_gamma": true
      , "width": 640
      , "resize_strategy": "fit"
      , "watermark_url": "http://s3.amazonaws.com/core.islandio/water/is-water-solid-dots-sm.png"
      , "watermark_position": "bottom-right"
    },
    "video_thumbs": {
        "use": ":original"
      , "robot": "/video/thumbs"
      , "width": 232
      , "resize_strategy": "fit"
    },
    "video_poster": {
        "use": ":original"
      , "robot": "/video/thumbs"
      , "count": 1
      , "width": 1280
      , "resize_strategy": "fit"
      , "watermark_url": "http://s3.amazonaws.com/core.islandio/water/is-water-solid-dots-lg.png"
      , "watermark_position": "bottom-right"
    },
    "video_encode": {
        "use": ":original"
      , "robot": "/video/encode"
      , "preset": "iphone"
      , "realtime": "true"
      , "width": 1280
      , "resize_strategy": "fit"
      , "ffmpeg": {
            "b": "5000k"
          }
      , "watermark_url": "http://s3.amazonaws.com/core.islandio/water/is-water-solid-dots-lg.png"
      , "watermark_position": "bottom-right"
    },
    "image_export": {
        "use": ["image_thumb", "image_full"]
      , "robot": "/s3/store"
      , "key": "AKIAJE7B76FRJNGSKWCA"
      , "secret": "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"
      , "bucket": "image.islandio"
      , "path": "${unique_prefix}.${file.ext}"
    },
    "video_export": {
        "use": ["video_thumbs", "video_poster", "video_encode"]
      , "robot": "/s3/store"
      , "key": "AKIAJE7B76FRJNGSKWCA"
      , "secret": "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"
      , "bucket": "video.islandio"
      , "path": "${unique_prefix}.${file.ext}"
    }
  }
}