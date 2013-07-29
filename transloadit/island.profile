{
  "steps": {
    "image_thumb": {
      "use": ":original",
      "robot": "/image/resize",
      "correct_gamma": true,
      "width": 232,
      "resize_strategy": "fit"
    },
    "image_full": {
      "use": ":original",
      "robot": "/image/resize",
      "correct_gamma": true,
      "width": 640,
      "resize_strategy": "fit"
    },
    "image_export": {
      "use": [
        "image_thumb",
        "image_full"
      ],
      "robot": "/s3/store",
      "key": "AKIAJE7B76FRJNGSKWCA",
      "secret": "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",
      "bucket": "image.islandio",
      "path": "${unique_prefix}.${file.ext}"
    }
  }
}
