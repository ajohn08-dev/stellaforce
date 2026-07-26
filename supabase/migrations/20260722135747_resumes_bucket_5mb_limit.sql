update storage.buckets set file_size_limit = 5242880 where id = 'resumes'; -- 5 MB, matches client-side validation
