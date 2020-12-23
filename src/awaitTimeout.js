module.exports = timeout =>
{
    return new Promise((resolve, reject) =>
    {
        setTimeout(resolve, timeout);
    });
}
