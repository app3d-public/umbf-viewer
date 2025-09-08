#include <acul/io/path.hpp>
#include <alwf/alwf.hpp>
#include <rapidjson/stringbuffer.h>
#include <rapidjson/writer.h>
#include <templates/loader.hpp>
#include <templates/view.hpp>
#include <umbf/umbf.hpp>
#include <umbf/utils.hpp>

struct LoadCache
{
    acul::string name;
    acul::shared_ptr<umbf::File> file;
    acul::shared_ptr<umbf::Image2D> image_block;
    acul::unique_ptr<void> pixels;
};

void load_image_file(acul::bin_stream &stream, acul::string &err, LoadCache &cache)
{
    auto file = umbf::File::read_from_bytes(stream);
    if (!file)
        err = acul::format("Failed to load image: %s", cache.name.c_str());
    else if (file->header.vendor_sign != UMBF_VENDOR_ID || file->header.type_sign != umbf::sign_block::format::image)
        err = "Unsupported image format";
    else
        cache.file = file;
}

void assign_image_info(acul::string &err, LoadCache &cache)
{
    if (!cache.file)
    {
        err = "Image file not loaded";
        return;
    }
    auto it = std::find_if(
        cache.file->blocks.begin(), cache.file->blocks.end(),
        [](const acul::shared_ptr<umbf::Block> &block) { return block->signature() == umbf::sign_block::image; });
    if (it == cache.file->blocks.end())
    {
        err = "Image block not found";
        return;
    }
    cache.image_block = acul::static_pointer_cast<umbf::Image2D>(*it);
}

void assign_image_buffer(acul::string &err, LoadCache &cache)
{
    if (!cache.image_block)
    {
        err = "Image block not loaded";
        return;
    }
    if (!cache.image_block->pixels) return;
    void *pixels = cache.image_block->pixels;
    umbf::ImageFormat required_format;
    required_format.type = umbf::ImageFormat::Type::uint;
    required_format.bytes_per_channel = 1;

    if (cache.image_block->format != required_format || cache.image_block->channels.size() != 4)
    {
        pixels = umbf::utils::convert_image(*cache.image_block, required_format, 4);
        acul::release(cache.image_block->pixels);
    }
    cache.image_block->pixels = nullptr;
    cache.pixels = acul::unique_ptr<void>(pixels);
}

int main()
{
    umbf::streams::HashResolver meta_resolver;
    meta_resolver.streams = {{umbf::sign_block::image, &umbf::streams::image},
                             {umbf::sign_block::image_atlas, &umbf::streams::image_atlas}};
    umbf::streams::resolver = &meta_resolver;

    LoadCache loaded;
    alwf::Router router;

    router.get["/"] = [](const alwf::Request &req) { return acul::alloc<alwf::TextResponse>(ahtt::loader::render()); };
    router.get["/view"] = [&](const alwf::Request &req) {
        return acul::alloc<alwf::TextResponse>(ahtt::view::render());
    };
    router.get["/view/image"] = [&](const alwf::Request &req) {
        acul::string err;
        assign_image_buffer(err, loaded);
        if (!err.empty())
        {
            LOG_ERROR("%s", err.c_str());
            return acul::alloc<alwf::BinaryViewResponse>();
        }
        else
        {
            char *p = static_cast<char *>(loaded.pixels.get());
            return acul::alloc<alwf::BinaryViewResponse>(p, loaded.image_block->width * loaded.image_block->height * 4);
        }
    };

    router.get["/api/image"] = [&](const alwf::Request &req) {
        rapidjson::Document doc;
        doc.SetObject();
        auto &a = doc.GetAllocator();

        acul::string err;
        assign_image_info(err, loaded);
        if (!err.empty())
        {
            LOG_ERROR("%s", err.c_str());
            doc.AddMember("success", false, a);
            rapidjson::Value error(err.c_str(), a);
            doc.AddMember("error", error, a);
            return acul::alloc<alwf::JSONResponse>(std::move(doc));
        }
        else
        {
            doc.AddMember("success", true, a);
            rapidjson::Value name(loaded.name.c_str(), a);
            doc.AddMember("name", name, a);

            doc.AddMember("vendor_sign", loaded.file->header.vendor_sign, a);
            doc.AddMember("vendor_version", loaded.file->header.vendor_version, a);
            doc.AddMember("type_sign", loaded.file->header.type_sign, a);
            doc.AddMember("spec_version", loaded.file->header.spec_version, a);
            doc.AddMember("compressed", loaded.file->header.compressed, a);
            doc.AddMember("checksum", loaded.file->checksum, a);
            doc.AddMember("width", loaded.image_block->width, a);
            doc.AddMember("height", loaded.image_block->height, a);

            rapidjson::Value channels(rapidjson::kArrayType);
            for (auto &channel : loaded.image_block->channels)
            {
                rapidjson::Value channel_name(channel.c_str(), a);
                channels.PushBack(channel_name, a);
            }
            doc.AddMember("channels", channels, a);

            acul::string format = acul::to_string(loaded.image_block->format);
            rapidjson::Value format_name(format.c_str(), a);
            doc.AddMember("format", format_name, a);

            rapidjson::StringBuffer buffer;
            rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
            doc.Accept(writer);
            return acul::alloc<alwf::JSONResponse>(std::move(doc));
        }
    };

    router.del["/api/image"] = [&](const alwf::Request &req) {
        loaded.name.clear();
        loaded.file.reset();
        loaded.image_block.reset();
        loaded.pixels.reset();
        return acul::alloc<alwf::JSONResponse>("{\"success\": true}");
    };

    router.post["/upload"] = [&](const alwf::Request &req) {
        loaded.name = req.get_header(ACUL_C_STR("X-File-Name"));
        LOG_INFO("Loading image: %s", loaded.name.c_str());
        acul::bin_stream stream{req.body.data(), req.body.size()};

        rapidjson::Document doc;
        doc.SetObject();
        auto &a = doc.GetAllocator();

        acul::string err;
        load_image_file(stream, err, loaded);
        if (err.empty())
        {
            doc.AddMember("success", true, a);
            return acul::alloc<alwf::JSONResponse>(std::move(doc));
        }
        else
        {
            LOG_ERROR("%s", err.c_str());
            doc.AddMember("success", false, a);
            rapidjson::Value error(err.c_str(), a);
            doc.AddMember("error", error, a);
            return acul::alloc<alwf::JSONResponse>(std::move(doc));
        }
    };

    acul::io::path current_path = acul::io::get_current_path();
    alwf::Options opt;
    opt.title = "UMBF Image Viewer";
    opt.width = 800;
    opt.height = 600;
    acul::string static_folder = current_path / "public";
    opt.static_folder = static_folder.c_str();
    opt.router = &router;

    alwf::init(opt);
    alwf::run();
    alwf::shutdown();
    return 0;
}